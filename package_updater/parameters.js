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
    const argv = process.argv;
    const self = this;

    const readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    getKituraVersion(readlineInterface, function(kituraVersion) {
        self.kituraVersion = kituraVersion;
        getSwiftVersion(readlineInterface, function(swiftVersion) {
            self.swiftVersion = swiftVersion;
            readlineInterface.close();
            callback();
        });
    });
}

function getKituraVersion(readlineInterface, callback) {
    const argv = process.argv;

    var kituraVersion = "";

    function readKituraVersion(callback) {
        getParameter(readlineInterface, 2, 'Please enter Kitura version to set in format <major>.<minor>, e.g. 0.26',
                     answer => { kituraVersion = answer;
                                 callback(null);});
    }

    async.doUntil(readKituraVersion, () => /^(\d+)\.(\d+)$/.test(kituraVersion),
                  () => callback(kituraVersion));
}

function getSwiftVersion(readlineInterface, callback) {
    return getParameter(readlineInterface, 3,
        'Please enter swift version, e.g. DEVELOPMENT-SNAPSHOT-2016-06-20-a', callback);
}

function getParameter(readlineInterface, parameterNumber, question, callback) {
    if (process.argv.length > parameterNumber) {
        callback(process.argv[parameterNumber]);
    }
    else {
        readlineInterface.question(question + ' > ',
                                   answer => callback(answer.trim()));
    }
}
