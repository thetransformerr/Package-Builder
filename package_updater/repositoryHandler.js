/**
 * Copyright IBM Corporation 2016
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = {getRepositoriesToHandle: getRepositoriesToHandle, clone: clone, pushNewVersions: pushNewVersions,
                  submitPRs: submitPRs};

const readline = require('readline');
const fs = require('fs');
const GithubAPI = require('github');
const git = require('nodegit');
const untildify = require('untildify');
const async = require('async');
const gittags = require('git-tags');
const simplegit = require('simple-git');
const spmHandler = require( __dirname + '/spmHandler.js');
const versionHandler = require( __dirname + '/versionHandler.js');

function getRepositoriesToHandle(callback) {
    async.parallel({
        repositoriesToUpdate: getRepositoriesToUpdate,
        ibmSwiftRepositories: getIBMSwiftRepositories
    }, function(error, result) {
        if (error) {
            return callback(error);
        }
        const repositoriesToHandle = result.ibmSwiftRepositories.filter(function(repository) {
            return result.repositoriesToUpdate[repository.name];
        });

        callback(null, repositoriesToHandle);
    });
}

function getRepositoriesToUpdate(callback) {
    var repositoriesToUpdate = {};

    const repositoriesToUpdateReader = readline.createInterface({
        input: fs.createReadStream('repos_to_update.txt')
    });

    repositoriesToUpdateReader.on('line', function(line) {
        line = line.split('#')[0]
        line = line.trim()
        if (!line) {
            return
        }
        repositoriesToUpdate[line] = true
    });

    repositoriesToUpdateReader.on('close', function() {
        callback(null, repositoriesToUpdate);
    });
}

function getIBMSwiftRepositories(callback) {
    const github = new GithubAPI({
        protocol: "https",
        host: "api.github.com",
        Promise: require('bluebird'),
        followRedirects: false,
        timeout: 5000
    });

    fs.readFile(untildify('~/.ssh/package_updater_github_token.txt'), 'utf8',
         function (error, token) {
             if (error) {
                 callback(error, null);
             }

             github.authenticate({ type: "oauth", token: token.trim() });

             github.repos.getForOrg({
                 org: "IBM-Swift",
                 type: "all",
                 per_page: 300
             }, callback);
         });
}

function clone(repositories, workDirectory, callback) {
    function cloneRepository(repository, callback) {
        cloneRepositoryByURLAndName(repository.git_url, repository.name, workDirectory,
            function(error, clonedRepository) {
                if (error) {
                    return callback(error, null);
                }
                getDecoratedRepository(clonedRepository, repository, workDirectory, callback);
            });
    }
    async.map(repositories, cloneRepository, callback);
}

function cloneRepositoryByURLAndName(repositoryURL, repositoryName, workDirectory, callback) {
    console.log(`cloning repository ${repositoryName}`);
    const repositoryDirectory = workDirectory + '/' + repositoryName;
    git.Clone(repositoryURL, repositoryDirectory).then(function(clonedRepository) {
        console.log(`cloned repository ${clonedRepository.workdir()}`)
        callback(null, clonedRepository);
    }).catch(callback);
}

// @param repositories - githubAPI Repository
// @param callback callback(error, decoratedRepositories)
// decorated Repositories (nodegit repository, largestVersion, name, packageJSON)
function getDecoratedRepository(repository, githubAPIRepository, workDirectory, callback) {
    gittags.latest(repository.workdir(), function(error, largestVersion) {
        if (error) {
            callback(error);
        }
        console.log(`last tag in ${githubAPIRepository.name} is ${largestVersion}`);
        spmHandler.getPackageAsJSON(repository.workdir(), function(error, packageJSON) {
            callback(error, { repository: repository, githubAPIRepository: githubAPIRepository,
                              largestVersion: largestVersion, packageJSON: packageJSON});
        });
    });
}

// @param repositories - decorated repositories (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function pushNewVersions(branchName, swiftVersion, repositories, versions, callback) {
    async.map(repositories, async.apply(pushNewVersion, branchName, swiftVersion, versions),
              callback);
}

// @param repository - decorated repository (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function pushNewVersion(branchName, swiftVersion, versions, repository, callback) {
    console.log(`handling repository ${repository.githubAPIRepository.name}`);
    console.log(`\tbranch ${branchName} swiftVersion ${swiftVersion}`);

    async.waterfall([async.apply(createBranch, branchName, repository.repository),
                     async.apply(updatePackageDotSwift, repository, versions)],
                    error => callback(error, repository));
}

// @param repositories - decorated repositories (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function submitPRs(branchName, repositories, callback) {
    versionHandler.logDecoratedRepositories(repositories, 'submiting PRs for repositories:');
    callback(null, 'done');
}

// @param repository - nodegit repository
function createBranch(branchName, repository, callback) {
    repository.getHeadCommit().then(function(commit) {
        git.Branch.create(repository, branchName, commit, false).then(function(reference) {
            repository.checkoutBranch(reference, new git.CheckoutOptions()).
                then(() => callback(null,reference)).catch(callback);
        }).catch(callback);
    }).catch(callback);
}

// @param repository - decorated repository (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function updatePackageDotSwift(repository, versions, branchReference, callback) {
    spmHandler.updateDependencies(repository.repository.workdir(), repository.packageJSON, versions,
        function(error, updatedDependencies) {
            if (error) {
                return callback(error);
            }
            if (!updatedDependencies) {
                return callback('no updatedDependencies returned from spmHandler.updateDependencies');
            }
            updatedDependencies = updatedDependencies.filter(member => member);
            if (updatedDependencies.length > 0) {
                return commitPackageDotSwift(repository.repository.workdir(), updatedDependencies, branchReference, callback);
            }
            callback(null);
        });
}

// @param repository - nodegit repository
function commitPackageDotSwift(repositoryDirectory, updatedDependencies, branchReference, callback) {
    var message = 'updated dependency versions in Package.swift';
    var detailsMessage = composeDetailsUpdatePackageDotSwiftCommitMessage(updatedDependencies);
    console.log('detailsMessage = ' + detailsMessage);
    simplegit(repositoryDirectory).commit(message, 'Package.swift', { '--message': detailsMessage}, callback);
}

function composeDetailsUpdatePackageDotSwiftCommitMessage(updatedDependencies) {
    return updatedDependencies.reduce(function(message, dependency) {
        return message + `changed version of ${dependency.dependencyURL} to ${dependency.version}\n`;
    },"");
}
