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

const readline = require('readline');
const fs = require('fs');
const GithubAPI = require('github');
const untildify = require('untildify');
const async = require('async');

function getRepositoriesToUpdate(callback) {
    'use strict';

    var repositoriesToUpdate = {};

    const repositoriesToUpdateReader = readline.createInterface({
        input: fs.createReadStream('repos_to_update.txt')
    });

    repositoriesToUpdateReader.on('line', line => {
        line = line.split('#')[0];
        line = line.trim();
        if (!line) {
            return;
        }
        repositoriesToUpdate[line] = true;
    });

    repositoriesToUpdateReader.on('close', () => {
        callback(null, repositoriesToUpdate);
    });
}

function getIBMSwiftRepositories(callback) {
    'use strict';

    const github = new GithubAPI({
        protocol: "https",
        host: "api.github.com",
        Promise: require('bluebird'),
        followRedirects: false,
        timeout: 5000
    });

    fs.readFile(untildify('~/.ssh/package_updater_github_token.txt'), 'utf8',
         (error, token) => {
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

function getRepositoriesToHandle(callback) {
    'use strict';
    async.parallel({
        repositoriesToUpdate: getRepositoriesToUpdate,
        ibmSwiftRepositories: getIBMSwiftRepositories
    }, (error, result) => {
        if (error) {
            return callback(error);
        }
        const repositoriesToHandle = result.ibmSwiftRepositories.filter(repository => {
            return result.repositoriesToUpdate[repository.name];
        });

        callback(null, repositoriesToHandle);
    });
}

module.exports = getRepositoriesToHandle;
