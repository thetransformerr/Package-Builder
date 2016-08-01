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

const Version = require( __dirname + '/Version.js');
const parameters = require( __dirname + '/parameters.js');
const swiftVersion = parameters.swiftVersion;
const kituraVersion = parameters.kituraVersion;

console.log(`setting Kitura Version to ${Version.versionAsString(kituraVersion)}`);
console.log(`setting swift version to ${swiftVersion}`);

const SPM = require( __dirname + '/SPM.js');
const getReposToUpdate = require( __dirname + '/getReposToUpdate.js');
const makeWorkDirectory = require( __dirname + '/makeWorkDirectory.js');
const GitHubApi = require("github");
const Git = require("nodegit");
const Async = require('async');

const github = new GitHubApi({
    protocol: "https",
    host: "api.github.com",
    Promise: require('bluebird'),
    followRedirects: false,
    timeout: 5000
});

getReposToUpdate(function(repositoriesToUpdate) {
    makeWorkDirectory(function(workDirectory) {
        github.repos.getForOrg({
            org: "IBM-Swift",
            type: "all",
            per_page: 300
        }, function(error, repositories) {
            var i = 0;
            var name = "";

            if(error) {
                console.error(`Error from getting repositories for IBM-Swift: ${error}`);
                return;
            }

            const repositoriesToHandle = repositories.filter(function(repository) {
                return repositoriesToUpdate[repository.name];
            });

            function cloneAndPreprocessRepository(repository, callback) {
                cloneAndPreprocessRepositoryByURLAndName(repository.git_url, repository.name, workDirectory, callback);
            }

            Async.map(repositoriesToHandle, cloneAndPreprocessRepository, processClonedRepositories);
        });
    });
});

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
    Git.Clone(repositoryURL, repositoryDirectory).then(function(clonedRepository) {
        console.log(`cloned repository ${clonedRepository.path()}`)

        Git.Tag.list(clonedRepository).then(function(tags) {
            const largestVersion = Version.getLargestVersion(tags, repositoryName);
            console.log(`last tag in ${repositoryName} is ${Version.versionAsString(largestVersion)}`);
            SPM.getPackageAsJSON(repositoryDirectory, function(error, packageJSON) {
                callback(error, { repository: clonedRepository, name: repositoryName,
                                  largestVersion: largestVersion, packageJSON: packageJSON});
            });
        });
    }).catch(function(error) {
        console.log(`Error in cloning: ${error}`);
        callback(error, null);
    });
}
