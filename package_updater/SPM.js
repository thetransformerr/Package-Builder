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

module.exports = { getPackageAsJSON: getPackageAsJSON };

const Exec = require('child_process').exec;
function getPackageAsJSON(repoDirectory, callback) {
    const swiftDumpPackageCommand = `swift package dump-package --input ${repoDirectory}/Package.swift`;
    Exec(swiftDumpPackageCommand, function (error, stdout, stderr) {
        var packageJSON = null
        if (error) {
            callback(error, null);
            return;
        }
        if (stderr) {
            console.warn(stderr);
        }

        packageJSON = JSON.parse(stdout);

        console.log(`package name for ${repoDirectory} is ${packageJSON.name}`);
        callback(null, packageJSON);
    });
}
