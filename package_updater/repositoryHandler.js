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
                   calculateNewVersions: calculateNewVersions };

const readline = require('readline');
const fs = require('fs');
const GitHubApi = require("github");
const git = require("nodegit");
const untildify = require('untildify');
const async = require('async');
const versionHandler = require( __dirname + '/versionHandler.js');
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
    const github = new GitHubApi({
        protocol: "https",
        host: "api.github.com",
        Promise: require('bluebird'),
        followRedirects: false,
        timeout: 5000
    });

    fs.readFile(untildify('~/.ssh/package_updater_github_token.txt'), 'utf8', function (error, token) {
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
                                        getRepositoryInfo(clonedRepository, repository.name, workDirectory,
                                                          callback);
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

function getRepositoryInfo(clonedRepository, repositoryName, workDirectory, callback) {
    const repositoryDirectory = workDirectory + '/' + repositoryName;

    git.Tag.list(clonedRepository).then(function(tags) {
        const largestVersion = versionHandler.getLargest(tags, repositoryName);
        console.log(`last tag in ${repositoryName} is ${versionHandler.asString(largestVersion)}`);
        spmHandler.getPackageAsJSON(repositoryDirectory, function(error, packageJSON) {
            callback(error, { repository: clonedRepository, name: repositoryName,
                              largestVersion: largestVersion, packageJSON: packageJSON});
        });
    });
}

function isKituraCoreRepository(repository) {
    return repository.name.startsWith('Kitura');
}

function calculateNewVersions(kituraVersion, decoratedRepositories, callback) {
    console.log(`got ${decoratedRepositories.length} repositories, ${versionHandler.asString(kituraVersion)}`);

    async.filter(decoratedRepositories, function(decoratedRepository, filterCallback) {
        wasRepositoryChangedAfterVersion(decoratedRepository.largestVersion,
                                         decoratedRepository.repository,
                                         filterCallback);
    }, function(error, changedRepositories) {
        console.log(`${changedRepositories.length} repositories were changed`);
        callback(null);
    });
}

function wasRepositoryChangedAfterVersion(version, repository, callback) {
    const versionString = versionHandler.asString(version);

    console.log(`checking if ${repository.workdir()} was changed after ${versionString}`);
    callback(null, true);
}
