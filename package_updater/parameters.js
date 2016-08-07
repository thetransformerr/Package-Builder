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

function Parameters() {
    'use strict';

    this.swiftVersion = null;
    this.kituraVersion = null;
}
module.exports = Parameters;

const readline = require('readline');
const async = require('async');

function getParameterFromUser(question, callback) {
    'use strict';

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

function getParameter(parameterNumber, question, callback) {
    'use strict';

    if (process.argv.length > parameterNumber) {
        callback(process.argv[parameterNumber]);
    }
    else {
        getParameterFromUser(question, callback);
    }
}

function getVerifiedParameter(parameterNumber, question, verify, callback) {
    'use strict';

    var parameter = process.argv[parameterNumber];

    function getParameter(callback) {
        getParameterFromUser(question, answer => { parameter = answer;
                                                   callback(null);});
    }

    async.until(() => verify(parameter), getParameter, () => callback(parameter));
}

function getBooleanParameter(parameterNumber, question, callback) {
    'use strict';
    getVerifiedParameter(parameterNumber,
                         question + ' [Yes|No]',
                         answer => answer === 'Yes' || answer === 'No',
                         answer => callback(answer === 'Yes'));
}


function getKituraVersion(callback) {
    'use strict';

    return getVerifiedParameter(2,
        'Please enter Kitura version to set in format <major>.<minor>, e.g. 0.26',
        kituraVersion => /^(\d+)\.(\d+)$/.test(kituraVersion),
        kituraVersion => callback(kituraVersion + '.0'));
}

function getSwiftVersion(callback) {
    'use strict';
    return getParameter(3,
        'Please enter swift version, e.g. DEVELOPMENT-SNAPSHOT-2016-06-20-a', callback);
}

Parameters.prototype.read = function(callback) {
    'use strict';

    const self = this;

    getKituraVersion(function(kituraVersion) {
        self.kituraVersion = kituraVersion;
        getSwiftVersion(function(swiftVersion) {
            self.swiftVersion = swiftVersion;
            callback();
        });
    });
};

Parameters.prototype.shouldPush = function(callback) {
    'use strict';
    getBooleanParameter(4, 'Would you like to push the changes', callback);
};

Parameters.prototype.shouldSubmitPRs = function(callback) {
    'use strict';
    getBooleanParameter(5, 'Would you like to submit the PRs?', callback);
};
