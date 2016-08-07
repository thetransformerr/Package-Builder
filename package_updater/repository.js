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

const simplegit = require('simple-git');
function Repository(nodegitRepository, githubAPIRepository, largestVersion, packageJSON) {
    'use strict';

    this.nodegitRepository = nodegitRepository;
    this.githubAPIRepository = githubAPIRepository;
    this.simplegitRepository = simplegit(nodegitRepository.workdir());
    this.largestVersion = largestVersion;
    this.packageJSON = packageJSON;
}
module.exports = Repository;

const gittags = require('git-tags');
const spmHandler = require( __dirname + '/spmHandler.js');
const git = require('nodegit');

Repository.prototype.name = function() {
    'use strict';
    return this.githubAPIRepository.name;
};

Repository.prototype.directory = function() {
    'use strict';
    return this.nodegitRepository.workdir();
};

Repository.prototype.getCloneURL = function() {
    'use strict';
    return this.nodegitRepository.clone_url;
};

Repository.log = function(repositories, title, doNotPrintEmpty) {
    'use strict';

    if (repositories.length > 0 || !doNotPrintEmpty) {
        console.log(title);
    }
    repositories.forEach(repository => console.log(`\t${repository.name()}`));
};


// @param repository - githubAPI repository
// @param callback callback(error, repository)

Repository.create = function(nodegitRepository, githubAPIRepository, workDirectory, callback) {
    'use strict';

    gittags.latest(nodegitRepository.workdir(), (error, largestVersion) => {
        if (error) {
            callback(error);
        }
        console.log(`last tag in ${githubAPIRepository.name} is ${largestVersion}`);
        spmHandler.getPackageAsJSON(nodegitRepository.workdir(), (error, packageJSON) => {
            callback(error, new Repository(nodegitRepository, githubAPIRepository,
                                           largestVersion, packageJSON));
        });
    });
};

Repository.prototype.createBranch = function(branchName, callback) {
    'use strict';

    const nodegitRepository = this.nodegitRepository;
    nodegitRepository.getHeadCommit().then(commit => {
        git.Branch.create(nodegitRepository, branchName, commit, false).then(reference => {
            nodegitRepository.checkoutBranch(reference, new git.CheckoutOptions()).
                then(() => callback(null)).catch(callback);
        }).catch(callback);
    }).catch(callback);
};

Repository.prototype.push = function(branchName, callback) {
    'use strict';
    this.simplegitRepository.push('origin', branchName, callback);
};

Repository.prototype.pushTags = function(callback) {
    'use strict';
    this.simplegitRepository.pushTags('origin', callback);
};

Repository.prototype.addTag = function(tag,callback) {
    'use strict';
    this.simplegitRepository.addTag(tag, callback);
};
