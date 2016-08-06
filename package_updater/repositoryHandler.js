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

module.exports = { getRepositoriesToHandle: getRepositoriesToHandle, clone: clone,
                   getNewVersions: getNewVersions };

const readline = require('readline');
const fs = require('fs');
const GithubAPI = require("github");
const git = require("nodegit");
const untildify = require('untildify');
const async = require('async');
const gittags = require("git-tags");
const GittoolsRepository = require("git-tools");
const semver = require("semver");
const spmHandler = require( __dirname + '/spmHandler.js');

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
    }).catch(function(error) {
        console.log(`Error in cloning: ${error}`);
        callback(error, null);
    });
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

// @param repository - decorated repository (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function isKituraCoreRepository(repository) {
    return repository.githubAPIRepository.name.startsWith('Kitura');
}

// @param repositories - decorated repositories (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function getNewVersions(kituraVersion, repositories, callback) {
    logDecoratedRepositories(repositories, `calculate new versions for repositories below, kitura version ${kituraVersion}`);
    getRepositoriesToBumpVersion(repositories,
        function(error, repositoriesToBumpVersion) {
            var newVersions = {};
            repositoriesToBumpVersion.forEach(repository =>
                newVersions[repository.githubAPIRepository.name] = getBumpedVersion(repository, kituraVersion));

            console.log(`${Object.keys(newVersions).length} repositories to set versions:`);
            Object.keys(newVersions).forEach(repository =>
                 console.log(`\t ${repository} ${newVersions[repository]}`));

            callback(null, repositoriesToBumpVersions, newVersions);
        });
}

// @param repository - decorated repository (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function getBumpedVersion(repository, kituraVersion) {
    if (isKituraCoreRepository(repository)) {
        return kituraVersion;
    }
    return semver.inc(repository.largestVersion, 'minor');
}

// @param repositories - decorated repositories (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function getRepositoriesToBumpVersion(repositories, callback) {
    getChangedRepositories(repositories, function(error, changedRepositories) {
        logDecoratedRepositories(changedRepositories, 'changed repositories');
        const unchangedRepositories = subtractArray(repositories, changedRepositories);
        logDecoratedRepositories(unchangedRepositories, 'unchanged repositories');
        callback(null, getTransitiveClosureOfDependencies(unchangedRepositories, changedRepositories));
    });
}

function subtractArray(array1, array2) {
    return array1.filter(member => array2.indexOf(member) < 0);
}

function logDecoratedRepositories(repositories, title, doNotPrintEmpty) {
    if (repositories.length > 0) {
        console.log(title);
    }
    repositories.forEach(repository => console.log(`\t${repository.githubAPIRepository.name}`));
}

// dependee terms from https://en.wiktionary.org/wiki/dependee
function getTransitiveClosureOfDependencies(repositoriesToCheck, dependeeRepositories) {
    // we define that dependee repositories depened on themselves in a trivial way
    var dependentRepositories = dependeeRepositories;
    var currentDependeeRepositories = dependeeRepositories;
    var currentRepositoriesToCheck = repositoriesToCheck;
    var currentDependetRepositories = [];
    var iteration = 0;
    var maximalNumberOfIterations = repositoriesToCheck.length;

    while (currentDependeeRepositories.length > 0 && iteration < maximalNumberOfIterations) {
        console.log(`calculating transitive closure of dependencies iteration ${iteration++}`);

        currentDependentRepositories = getDependentRepositories(currentRepositoriesToCheck, currentDependeeRepositories);
        logDecoratedRepositories(currentDependentRepositories, 'repositories that depend on changed repositories', true);

        dependentRepositories = dependentRepositories.concat(currentDependentRepositories);
        currentDependeeRepositories = currentDependentRepositories;
        currentRepositoriesToCheck = subtractArray(currentRepositoriesToCheck, currentDependentRepositories);
    }

    return dependentRepositories;
}

// @param repositoriesToCheck - decorated repositories (nodegit repository, githubAPI repository, largestVersion, packageJSON)
// @param dependeeRepositories - decorated repositories (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function getDependentRepositories(repositoriesToCheck, dependeeRepositories) {
    return repositoriesToCheck.filter(repository => doesRepositoryDependOn(repository.packageJSON, dependeeRepositories));
}

// @param dependeeRepositories - decorated repositories (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function doesRepositoryDependOn(packageJSON, dependeeRepositories) {
    return packageJSON.dependencies.some(function(dependency) {
        return dependeeRepositories.some(dependeeRepository =>
                                         dependeeRepository.githubAPIRepository.clone_url == dependency.url);
    });
}

// @param repositoriesToCheck - decorated repositories (nodegit repository, githubAPI repository, largestVersion, packageJSON)
function getChangedRepositories(repositories, callback) {
    async.filter(repositories, function(repository, filterCallback) {
        wasRepositoryChangedAfterVersion(repository.largestVersion, repository.repository,
                                         filterCallback);
    }, callback);
}

// @param nodegit repository
function wasRepositoryChangedAfterVersion(version, repository, callback) {
    getTagCommit(version, repository.workdir(), function(error, tagCommit) {
        if (error) {
            return callback(error, false);
        }
        repository.getHeadCommit().then(function(headCommit) {
            console.log(`${repository.workdir()}: ${version} ${tagCommit.sha} ${tagCommit.date}, head commit ${headCommit.sha()} ${headCommit.date()}`);
            callback(null, isLaterCommit(headCommit, tagCommit));
        });
    });
}

// @param commit1 - nodegit commit
// @param commit2 - gittools commit
// returns true if the first commit is later than the second one
function isLaterCommit(commit1, commit2) {
    // there is an issue with handling annotated tags vs. lightweight tags -
    //      the dates have different meaning
    // for lightweight tags, commits should match if commit1 is not later than commit2,
    //     but the dates could be nonmatching
    // for annotated tags, commits will not match even if commit1 is not later than commit2,
    //     so dates should be checked for annotated tags
    if (commit1.sha() == commit2.sha) {
        return false;
    }
    return commit1.date() > commit2.date;
}

function getTagCommit(tag, repositoryDirectory, callback) {
    const gittoolsRepository = new GittoolsRepository(repositoryDirectory);
    gittoolsRepository.tags(function(error, tags) {
        if (error) {
            return callback(error, null);
        }
        const matchingTags = tags.filter(tagToFilter => tagToFilter.name == tag);
        if (matchingTags.length != 1) {
            return callback(`no matching tags for ${version} in ${repositoryDirectory}`, null);
        }
        const matchingTag = matchingTags[0];
        callback(error, matchingTag);
    });
}
