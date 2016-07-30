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

const parameters = require( __dirname + '/parameters.js');
const swiftVersion = parameters.swiftVersion;
const kituraVersion = parameters.kituraVersion;

console.log(`setting Kitura Version to ${kituraVersion.major}.${kituraVersion.minor}`);
console.log(`setting swift version to ${swiftVersion}`);

const Tags = require( __dirname + '/tags.js');
const SPM = require( __dirname + '/SPM.js');
const getReposToUpdate = require( __dirname + '/getReposToUpdate.js');
const makeWorkDirectory = require( __dirname + '/makeWorkDirectory.js');
const GitHubApi = require("github");
const Git = require("nodegit");
const async = require('async');

const github = new GitHubApi({
    protocol: "https",
    host: "api.github.com",
    Promise: require('bluebird'),
    followRedirects: false,
    timeout: 5000
});

getReposToUpdate(function(reposToUpdate) {
    makeWorkDirectory(function(workDirectory) {
        github.repos.getForOrg({
            org: "IBM-Swift",
            type: "all",
            per_page: 300
        }, function(error, repos) {
            var i = 0;
            var name = "";

            if(error) {
                console.error(`Error from getting repositories for IBM-Swift: ${error}`);
                return;
            }

            const reposToHandle = repos.filter(function(repo) {
                return reposToUpdate[repo.name];
            });

            function handleRepo(repo, callback) {
                handleRepoByURLAndName(repo.git_url, repo.name, workDirectory, callback);
            }

            async.map(reposToHandle, handleRepo, function(error, repos) {
                if (error) {
                    console.error(`Error in cloning repos ${error}`);
                    return;
                }
                console.log(`finished cloning ${repos.length} repos`);
            });
        });
    });
});

function handleRepoByURLAndName(repoURL, repoName, workDirectory, callback) {
    console.log(`cloning repo ${repoName}`);
    const repoDirectory = workDirectory + '/' + repoName;
    Git.Clone(repoURL, repoDirectory).then(function(clonedRepo) {
        console.log(`cloned repo ${clonedRepo.path()}`)

        Git.Tag.list(clonedRepo).then(function(tags) {
            const largestVersion = Tags.getLargestVersion(tags, repoName);
            console.log(`last tag in ${repoName} is ${largestVersion.major}.${largestVersion.minor}`);
            SPM.getPackageAsJSON(repoDirectory, function(error, packageJSON) {
                callback(error, clonedRepo);
            });
        });
    }).catch(function(error) {
        console.log(`Error in cloning: ${error}`);
        callback(error, null);
    });
}
