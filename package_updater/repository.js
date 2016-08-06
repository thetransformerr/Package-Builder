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

module.exports = Repository;

const simplegit = require('simple-git');

function Repository(nodegitRepository, githubAPIRepository, largestVersion, packageJSON) {
    this.nodegitRepository = nodegitRepository;
    this.githubAPIRepository = githubAPIRepository;
    this.simplegitRepository = simplegit(nodegitRepository.workdir());
    this.largestVersion = largestVersion;
    this.packageJSON = packageJSON;
}

Repository.prototype.name = function() {
    return this.githubAPIRepository.name;
}

Repository.prototype.directory = function() {
    return this.nodegitRepository.workdir();
}

Repository.log = function(repositories, title, doNotPrintEmpty) {
    if (repositories.length > 0) {
        console.log(title);
    }
    repositories.forEach(repository => console.log(`\t${repository.name()}`));
}
