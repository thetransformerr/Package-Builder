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
const parameters = require( __dirname + '/parameters.js');

const swiftVersion = parameters.swiftVersion;
const kituraVersion = parameters.kituraVersion;
console.log(`setting Kitura Version to ${kituraVersion}`);
console.log(`setting swift version to ${swiftVersion}`);
const branchName = `automatic_migration_to_${kituraVersion}`;

function setup(callback) {
    async.parallel({ workDirectory: makeWorkDirectory,
                     repositoriesToHandle: repositoryHandler.getRepositoriesToHandle
    }, (error, results) =>  callback(error, results.repositoriesToHandle, results.workDirectory));
}

async.waterfall([setup,
                 repositoryHandler.clone,
                 async.apply(versionHandler.getNewVersions, kituraVersion),
                 async.apply(repositoryHandler.pushNewVersions, branchName, swiftVersion),
                 async.apply(repositoryHandler.submitPRs, branchName)],
                function(error, result) {
                    if (error) {
                        return console.error(`Error in updating repositories ${error}`);
                    }
                    console.log('Done');
                 });
