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

module.exports = Parameters;

const readline = require('readline');
const async = require('async');

function Parameters() {
    this.swiftVersion = null;
    this.kituraVersion = null;
}

Parameters.prototype.read = function(callback) {
    const self = this;

    getKituraVersion(function(kituraVersion) {
        self.kituraVersion = kituraVersion;
        getSwiftVersion(function(swiftVersion) {
            self.swiftVersion = swiftVersion;
            callback();
        });
    });
}

function getKituraVersion(callback) {
    return getVerifiedParameter(2,
        'Please enter Kitura version to set in format <major>.<minor>, e.g. 0.26',
        kituraVersion => /^(\d+)\.(\d+)$/.test(kituraVersion),
        kituraVersion => callback(kituraVersion + '.0'));
}

function getSwiftVersion(callback) {
    return getParameter(3,
        'Please enter swift version, e.g. DEVELOPMENT-SNAPSHOT-2016-06-20-a', callback);
}

function getParameter(parameterNumber, question, callback) {
    if (process.argv.length > parameterNumber) {
        callback(process.argv[parameterNumber]);
    }
    else {
        getParameterFromUser(question, callback);
    }
}

function getParameterFromUser(question, callback) {
    const readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readlineInterface.question(question + ' > ',
                               function(answer) {
                                   readlineInterface.close();
                                   callback(answer.trim());
                               });
}

function getVerifiedParameter(parameterNumber, question, verify, callback) {
    var parameter = process.argv[parameterNumber];

    function getParameter(callback) {
        getParameterFromUser(question, answer => { parameter = answer;
                                                   callback(null);});
    }

    async.until(() => verify(parameter), getParameter, () => callback(parameter));
}

function getBooleanParameter(parameterNumber, question, callback) {
    getVerifiedParameter(parameterNumber,
                         question + ' [Yes|No]',
                         answer => answer === 'Yes' || answer === 'No',
                         answer => callback(answer === 'Yes'));
}


Parameters.prototype.shouldPush = function(callback) {
    getBooleanParameter(4, 'Would you like to push the changes', callback);
}

Parameters.prototype.shouldSubmitPRs = function(callback) {
    getBooleanParameter(5, 'Would you like to submit the PRs?', callback);
}
