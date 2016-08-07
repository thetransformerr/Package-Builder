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

const async = require('async');
const repositoryHandler = require( __dirname + '/repositoryHandler.js');
const makeWorkDirectory = require( __dirname + '/makeWorkDirectory.js');
const versionHandler = require( __dirname + '/versionHandler.js');
const getRepositoriesToHandle = require( __dirname + '/getRepositoriesToHandle.js');
const clone = require( __dirname + '/clone.js');
const submitPRs = require( __dirname + '/submitPRs.js');

const Repository = require( __dirname + '/repository.js');
const Parameters = require( __dirname + '/parameters.js');

const parameters = new Parameters();
var branchName = "";

function setup(callback) {
    'use strict';
    async.parallel({ workDirectory: makeWorkDirectory,
                     repositoriesToHandle: getRepositoriesToHandle
                   }, (error, results) =>  callback(error, results.repositoriesToHandle,
                                                    results.workDirectory));
}

function getGoodByeMessage() {
    'use strict';
    return 'Done';
}

function shouldPush(repositories, newVersions, callback) {
    'use strict';
    if (repositories.length < 1) {
        return callback('No repositories were changed - nothing to push', null, null);
    }

    console.log(`${Object.keys(newVersions).length} repositories to push:`);
    Object.keys(newVersions).forEach(repository =>
                                     console.log(`\t ${repository} ${newVersions[repository]}`));

    var credentials = repositories[0].getCredentials();
    console.log(`credentials to be used: ${credentials.name} ${credentials.email}`);

    parameters.shouldPush(shouldPush => {
        if (shouldPush) {
            callback(null, repositories, newVersions);
        } else {
            callback(getGoodByeMessage(), null, null);
        }
    });
}

function shouldSubmitPRs(repositories, callback) {
    'use strict';
    Repository.log(repositories, 'Repositories to submit PRs:');
    parameters.shouldSubmitPRs(shouldSubmitPRs => {
        if (shouldSubmitPRs) {
            callback(null, repositories);
        } else {
            callback(getGoodByeMessage(), null);
        }
    });
}

parameters.read(() => {
    'use strict';
    console.log(`setting Kitura Version to ${parameters.kituraVersion}`);
    console.log(`setting swift version to ${parameters.swiftVersion}`);
    branchName = `automatic_migration_to_${parameters.kituraVersion}`;

    async.waterfall([setup,
                     clone,
                     async.apply(versionHandler.getNewVersions, parameters.kituraVersion),
                     shouldPush,
                     async.apply(repositoryHandler.pushNewVersions, branchName,
                                 parameters.swiftVersion),
                     shouldSubmitPRs,
                     async.apply(submitPRs, branchName)],
                    error => {
                        if (error) {
                            return console.log(error);
                        }
                        console.log(getGoodByeMessage());
                    });
});
