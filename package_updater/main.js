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

const Tags = require( __dirname + '/tags.js');
const parameters = require( __dirname + '/parameters.js');

const swiftVersion = parameters.swiftVersion;
const kituraVersion = parameters.kituraVersion;

console.log(`setting Kitura Version to ${kituraVersion.major}.${kituraVersion.minor}`);
console.log(`setting swift version to ${swiftVersion}`);

const GitHubApi = require("github");
const Git = require("nodegit");
const async = require('async');
const readline = require('readline');
const fs = require('fs');
const exec = require('child_process').exec;

const github = new GitHubApi({
    // optional
    debug: false,
    protocol: "https",
    host: "api.github.com", // should be api.github.com for GitHub
    headers: {
        "user-agent": "My-Cool-GitHub-App" // GitHub is happy with a unique user agent
    },
    Promise: require('bluebird'),
    followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
    timeout: 5000
});

const format = require('date-format');
const dateString = format.asString('MM_dd_yy', new Date())
const workDirectory = 'KituraPackagesToUpdate_' + dateString

var reposToUpdate = {};

const reposToUpdateReader = readline.createInterface({
    input: fs.createReadStream('repos_to_update.txt')
});

reposToUpdateReader.on('line', function(line) {
    line = line.split('#')[0]
    line = line.trim()
    if (!line) {
        return
    }
    reposToUpdate[line] = true
});

reposToUpdateReader.on('close', function() {
    fs.mkdir(workDirectory, function(err) {
        if (err) {
            console.error(err)
            return
        }
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

function handleRepo(repo, callback) {
    handleRepoByURLAndName(repo.git_url, repo.name, callback);
}

function handleRepoByURLAndName(repoURL, repoName, callback) {
    console.log(`cloning repo ${repoName}`);
    const repoDirectory = workDirectory + '/' + repoName;
    Git.Clone(repoURL, repoDirectory).then(function(clonedRepo) {
        console.log(`cloned repo ${clonedRepo.path()}`)

        Git.Tag.list(clonedRepo).then(function(tags) {
            const largestVersion = Tags.getLargestVersion(tags, repoName);
            const swiftDumpPackageCommand = `swift package dump-package --input ${repoDirectory}/Package.swift`;
            console.log(`last tag in ${repoName} is ${largestVersion.major}.${largestVersion.minor}`);

            exec(swiftDumpPackageCommand, function (error, stdout, stderr) {
                var packageJSON = null
                if (error) {
                    callback(error, null);
                    return;
                }

                if (stderr) {
                    console.warn(stderr);
                }
                packageJSON = JSON.parse(stdout);

                console.log(`package name for ${repoName} is ${packageJSON.name}`);
                callback(null, clonedRepo);
            });
        });
    }).catch(function(error) {
        console.log(`Error in cloning: ${error}`);
        callback(error, null);
    });
}
