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

const Format = require('date-format');
const FS = require('fs');

module.exports = function(callback) {
    const dateString = Format.asString('MM_dd_yy', new Date())
    const workDirectory = 'KituraPackagesToUpdate_' + dateString

    FS.mkdir(workDirectory, function(err) {
        if (err) {
            console.error(err);
            process.exit();
        }
        callback(workDirectory);
    });
}
