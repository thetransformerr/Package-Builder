
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

// module.exports defined at the bottom of the file

const GittoolsRepository = require('git-tools');
const semver = require('semver');
const async = require('async');
const Repository = require( __dirname + '/repository.js');

// @param repository - Repository
function isKituraCoreRepository(repository) {
    'use strict';
    return repository.githubAPIRepository.name.startsWith('Kitura');
}

// @param repository - Repository
function getBumpedVersion(repository, kituraVersion) {
    'use strict';
    if (isKituraCoreRepository(repository)) {
        return kituraVersion;
    }
    return semver.inc(repository.largestVersion, 'minor');
}

function subtractArray(array1, array2) {
    'use strict';
    return array1.filter(member => array2.indexOf(member) < 0);
}

// @param commit1 - nodegit commit
// @param commit2 - gittools commit
// returns true if the first commit is later than the second one
function isLaterCommit(commit1, commit2) {
    'use strict';
    // there is an issue with handling annotated tags vs. lightweight tags -
    //      the dates have different meaning
    // for lightweight tags, commits should match if commit1 is not later than commit2,
    //     but the dates could be nonmatching
    // for annotated tags, commits will not match even if commit1 is not later than commit2,
    //     so dates should be checked for annotated tags
    if (commit1.sha() === commit2.sha) {
        return false;
    }
    return commit1.date() > commit2.date;
}

function getTagCommit(tag, repositoryDirectory, callback) {
    'use strict';

    const gittoolsRepository = new GittoolsRepository(repositoryDirectory);
    gittoolsRepository.tags((error, tags) => {
        if (error) {
            return callback(error, null);
        }
        const matchingTags = tags.filter(tagToFilter => tagToFilter.name === tag);
        if (matchingTags.length !== 1) {
            return callback(`no matching tags for ${version} in ${repositoryDirectory}`, null);
        }
        const matchingTag = matchingTags[0];
        callback(error, matchingTag);
    });
}

// @param repository - nodegit repository
function wasRepositoryChangedAfterVersion(version, repository, callback) {
    'use strict';
    getTagCommit(version, repository.workdir(), (error, tagCommit) => {
        if (error) {
            return callback(error, false);
        }
        repository.getHeadCommit().then(headCommit => {
            console.log(`${repository.workdir()}: ${version} ${tagCommit.sha} ${tagCommit.date},` +
                        ` head commit ${headCommit.sha()} ${headCommit.date()}`);
            callback(null, isLaterCommit(headCommit, tagCommit));
        });
    });
}

// @param dependeeRepositories - Repository
function doesRepositoryDependOn(packageJSON, dependeeRepositories) {
    'use strict';
    return packageJSON.dependencies.some(dependency =>
        dependeeRepositories.some(dependeeRepository =>
                                  dependeeRepository.getCloneURL() === dependency.url));
}

// @param repositoriesToCheck - Repository
// @param dependeeRepositories - Repository
function getDependentRepositories(repositoriesToCheck, dependeeRepositories) {
    'use strict';
    return repositoriesToCheck.filter(repository =>
        doesRepositoryDependOn(repository.packageJSON, dependeeRepositories));
}

// @param repositoriesToCheck - Repository
function getChangedRepositories(repositories, callback) {
    'use strict';
    async.filter(repositories, (repository, filterCallback) => {
        wasRepositoryChangedAfterVersion(repository.largestVersion,
            repository.nodegitRepository, filterCallback);
    }, callback);
}

// dependee terms from https://en.wiktionary.org/wiki/dependee
function getTransitiveClosureOfDependencies(repositoriesToCheck, dependeeRepositories) {
    'use strict';
    // we define that dependee repositories depened on themselves in a trivial way
    var dependentRepositories = dependeeRepositories;
    var currentDependeeRepositories = dependeeRepositories;
    var currentRepositoriesToCheck = repositoriesToCheck;
    var currentDependentRepositories = [];
    var iteration = 0;
    var maximalNumberOfIterations = repositoriesToCheck.length;

    while (currentDependeeRepositories.length > 0 && iteration < maximalNumberOfIterations) {
        console.log(`calculating transitive closure of dependencies iteration ${iteration++}`);

        currentDependentRepositories =
            getDependentRepositories(currentRepositoriesToCheck, currentDependeeRepositories);
        Repository.log(currentDependentRepositories,
                       'repositories that depend on changed repositories', true);

        dependentRepositories = dependentRepositories.concat(currentDependentRepositories);
        currentDependeeRepositories = currentDependentRepositories;
        currentRepositoriesToCheck = subtractArray(currentRepositoriesToCheck,
                                                   currentDependentRepositories);
    }

    return dependentRepositories;
}

// @param repositories - Repository
function getRepositoriesToBumpVersion(repositories, callback) {
    'use strict';
    getChangedRepositories(repositories, (error, changedRepositories) => {
        if (error) {
            callback(error, null, null);
        }
        Repository.log(changedRepositories, 'changed repositories');
        const unchangedRepositories = subtractArray(repositories, changedRepositories);
        Repository.log(unchangedRepositories, 'unchanged repositories');
        callback(null, getTransitiveClosureOfDependencies(unchangedRepositories,
                                                          changedRepositories));
    });
}

// @param repositories - Repository
function getNewVersions(kituraVersion, repositories, callback) {
    'use strict';

    Repository.log(repositories, `get new versions of repositories, version ${kituraVersion}`);
    getRepositoriesToBumpVersion(repositories, (error, repositoriesToBumpVersion) => {
        var newVersions = {};
        repositoriesToBumpVersion.forEach(repository =>
            newVersions[repository.getCloneURL()] =
                getBumpedVersion(repository, kituraVersion));

        callback(null, repositoriesToBumpVersion, newVersions);
    });
}

module.exports = {getNewVersions: getNewVersions};
