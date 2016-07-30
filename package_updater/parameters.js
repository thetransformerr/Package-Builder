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


module.exports = function() {
    const VersionHandler = require( __dirname + '/VersionHandler.js');
    const argv = process.argv
    const exit = process.exit

    if (argv.length < 4) {
        console.warn('Format: npm start <major Kitura version to set>.<minor Kitura version to set> <swift version to set>')
        exit();
    }

    const kituraVersion = argv[2]
    const swiftVersion = argv[3]

    if (!/^(\d+)\.(\d+)$/.test(kituraVersion)) {
        console.error('Kitura version parameter should be in the format <major>.<minor>');
        exit();
    }

    return { swiftVersion: swiftVersion, kituraVersion: VersionHandler.extractMajorMinorTuple(kituraVersion) }
}();
