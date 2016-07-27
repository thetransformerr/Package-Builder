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

var GitHubApi = require("github");
var Git = require("nodegit");
var mkdirp = require("mkdirp");
var async = require('async');
const readline = require('readline');
const fs = require('fs');

var github = new GitHubApi({
    // optional
    debug: true,
    protocol: "https",
    host: "api.github.com", // should be api.github.com for GitHub
    headers: {
        "user-agent": "My-Cool-GitHub-App" // GitHub is happy with a unique user agent
    },
    Promise: require('bluebird'),
    followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
    timeout: 5000
});

var format = require('date-format');
var dateString = format.asString('MM_dd_yy', new Date())
var workDirectory = 'KituraPackagesToUpdate_' + dateString

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
    mkdirp(workDirectory, function(err) {
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
            var reposToHandle = []

            if(error) {
                console.error('Error from getting repositories for IBM-Swift: ' + error);
                return;
            }
            reposToHandle = repos.filter(function(repo) {
                return reposToUpdate[repo.name]
            });
            async.each(reposToHandle, cloneRepo, function() {
                console.log('finished cloning repos')
            });
        });
    });
});

function cloneRepo(repo, callback) {
    name = repo.name
    console.log('cloning repo ' + name);
    Git.Clone(repo.git_url, workDirectory + '/' + name).then(function(cloned) {
        console.log('cloned repo' + cloned.path())
        callback()
    })
}
