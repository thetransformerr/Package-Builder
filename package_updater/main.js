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

const versionHandler = require( __dirname + '/versionHandler.js');
const parameters = require( __dirname + '/parameters.js');
const swiftVersion = parameters.swiftVersion;
const kituraVersion = parameters.kituraVersion;

console.log(`setting Kitura Version to ${versionHandler.asString(kituraVersion)}`);
console.log(`setting swift version to ${swiftVersion}`);

const spmHandler = require( __dirname + '/spmHandler.js');
const repositoryHandler = require( __dirname + '/repositoryHandler.js');
const makeWorkDirectory = require( __dirname + '/makeWorkDirectory.js');
const git = require("nodegit");
const async = require('async');

async.parallel({
    workDirectory: makeWorkDirectory,
    repositoriesToHandle: repositoryHandler.getRepositoriesToHandle
}, updateRepositories);

function updateRepositories(error, results) {
    if(error) {
        console.error(error);
        return;
    }

    function cloneAndPreprocessRepository(repository, callback) {
        cloneAndPreprocessRepositoryByURLAndName(repository.git_url, repository.name,
                                                 results.workDirectory, callback);
    }

    async.map(results.repositoriesToHandle, cloneAndPreprocessRepository, processClonedRepositories);
}

function processClonedRepositories(error, repositories) {
    if (error) {
        console.error(`Error in cloning repositories ${error}`);
        return;
    }
    console.log(`finished cloning ${repositories.length} repositories`);
}

function isKituraCoreRepository(repository) {
    return repository.name.startsWith('Kitura');
}

function wasRepositoryChangedAfterTag(clonedRepository, tag) {

}

function cloneAndPreprocessRepositoryByURLAndName(repositoryURL, repositoryName, workDirectory, callback) {
    console.log(`cloning repository ${repositoryName}`);
    const repositoryDirectory = workDirectory + '/' + repositoryName;
    git.Clone(repositoryURL, repositoryDirectory).then(function(clonedRepository) {
        console.log(`cloned repository ${clonedRepository.path()}`)

        git.Tag.list(clonedRepository).then(function(tags) {
            const largestVersion = versionHandler.getLargest(tags, repositoryName);
            console.log(`last tag in ${repositoryName} is ${versionHandler.asString(largestVersion)}`);
            spmHandler.getPackageAsJSON(repositoryDirectory, function(error, packageJSON) {
                callback(error, { repository: clonedRepository, name: repositoryName,
                                  largestVersion: largestVersion, packageJSON: packageJSON});
            });
        });
    }).catch(function(error) {
        console.log(`Error in cloning: ${error}`);
        callback(error, null);
    });
}
