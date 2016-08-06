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
const Parameters = require( __dirname + '/parameters.js');
const git = require("nodegit");

const parameters = new Parameters();
var branchName = ""

parameters.read(function() {
    console.log(`setting Kitura Version to ${parameters.kituraVersion}`);
    console.log(`setting swift version to ${parameters.swiftVersion}`);
    branchName = `automatic_migration_to_${parameters.kituraVersion}`;

    async.waterfall([setup,
                     repositoryHandler.clone,
                     async.apply(versionHandler.getNewVersions, parameters.kituraVersion),
                     shouldPush,
                     async.apply(repositoryHandler.pushNewVersions, branchName, parameters.swiftVersion),
                     shouldSubmitPRs,
                     async.apply(repositoryHandler.submitPRs, branchName)],
                    function(error, result) {
                        if (error) {
                            return console.log(error);
                        }
                        console.log(getGoodByeMessage());
                    });
});

function setup(callback) {
    async.parallel({ workDirectory: makeWorkDirectory,
                     repositoriesToHandle: repositoryHandler.getRepositoriesToHandle
                   }, (error, results) =>  callback(error, results.repositoriesToHandle, results.workDirectory));
}

function getGoodByeMessage() {
    return 'Done';
}

function shouldPush(repositories, newVersions, callback) {
    if (repositories.length < 1) {
        return callback('No repositories were changed - nothing to push', null, null);
    }

    console.log(`${Object.keys(newVersions).length} repositories to push:`);
    Object.keys(newVersions).forEach(repository =>
                                     console.log(`\t ${repository} ${newVersions[repository]}`));

    var signature = git.Signature.default(repositories[0].repository);
    console.log(`signature to be used: ${signature.name()} ${signature.email()}`);

    parameters.shouldPush(function(shouldPush) {
        if (shouldPush) {
            callback(null, repositories, newVersions);
        } else {
            callback(getGoodByeMessage(), null, null);
        }
    });
}

function shouldSubmitPRs(repositories, callback) {
    versionHandler.logDecoratedRepositories(repositories, 'Repositories to submit PRs:');
    parameters.shouldSubmitPRs(function(shouldSubmitPRs) {
        if (shouldSubmitPRs) {
            callback(null, repositories);
        } else {
            callback(getGoodByeMessage(), null);
        }
    });
}
