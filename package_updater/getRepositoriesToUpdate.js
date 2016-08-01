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

const Readline = require('readline');
const FS = require('fs');

module.exports = function(callback) {
    var repositoriesToUpdate = {};

    const repositoriesToUpdateReader = Readline.createInterface({
        input: FS.createReadStream('repos_to_update.txt')
    });

    repositoriesToUpdateReader.on('line', function(line) {
        line = line.split('#')[0]
        line = line.trim()
        if (!line) {
            return
        }
        repositoriesToUpdate[line] = true
    });

    repositoriesToUpdateReader.on('close', function() {
        callback(repositoriesToUpdate);
    });
}
