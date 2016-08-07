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
const GittoolsRepository = require('git-tools');

Repository.prototype.getName = function() {
    'use strict';
    return this.githubAPIRepository.name;
};

Repository.prototype.getDirectory = function() {
    'use strict';
    return this.nodegitRepository.workdir();
};

Repository.prototype.getCloneURL = function() {
    'use strict';
    return this.githubAPIRepository.clone_url;
};

Repository.log = function(repositories, title, doNotPrintEmpty) {
    'use strict';

    if (repositories.length > 0 || !doNotPrintEmpty) {
        console.log(title);
    }
    repositories.forEach(repository => console.log(`\t${repository.getName()}`));
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


// @param commit1 - nodegit commit
// @param commit2 - gittools commit
// returns true if the first commit is later than the second one
function isLaterCommit(commit1, commit2) {
    'use strict';
    // there is an issue with handling annotated tags vs. lightweight tags -
    //      the dates have different meaning
    // for lightweight tags, commits should match if commit1 is not later than commit2,
    //     but the dates could be nonmatching
    // for annotated tags, commits will not match even if commit1 is not later than commit2,
    //     so dates should be checked for annotated tags
    if (commit1.sha() === commit2.sha) {
        return false;
    }
    return commit1.date() > commit2.date;
}

function getTagCommit(tag, repositoryDirectory, callback) {
    'use strict';

    const gittoolsRepository = new GittoolsRepository(repositoryDirectory);
    gittoolsRepository.tags((error, tags) => {
        if (error) {
            return callback(error, null);
        }
        const matchingTags = tags.filter(tagToFilter => tagToFilter.name === tag);
        if (matchingTags.length !== 1) {
            return callback(`no matching tags for ${version} in ${repositoryDirectory}`, null);
        }
        const matchingTag = matchingTags[0];
        callback(error, matchingTag);
    });
}

// @param repository - nodegit repository
Repository.prototype.wasChangedAfterVersion = function(version, callback) {
    'use strict';

    const self = this;
    getTagCommit(version, self.getDirectory(), (error, tagCommit) => {
        if (error) {
            return callback(error, false);
        }
        self.nodegitRepository.getHeadCommit().then(headCommit => {
            console.log(`${self.getName()}: ${version} ${tagCommit.sha} ${tagCommit.date},` +
                        ` head commit ${headCommit.sha()} ${headCommit.date()}`);
            callback(null, isLaterCommit(headCommit, tagCommit));
        });
    });
}
