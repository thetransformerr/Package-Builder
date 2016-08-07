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

// module.exports defined at the bottom of the file

const git = require('nodegit');
const async = require('async');
const Repository = require( __dirname + '/repository.js');

function cloneRepositoryByURLAndName(repositoryURL, repositoryName, workDirectory, callback) {
    'use strict';

    console.log(`cloning repository ${repositoryName}`);
    const repositoryDirectory = workDirectory + '/' + repositoryName;
    git.Clone(repositoryURL, repositoryDirectory).then(clonedRepository => {
        console.log(`cloned repository ${clonedRepository.workdir()}`);
        callback(null, clonedRepository);
    }).catch(callback);
}

// @param repositories - githubAPI repository
function clone(repositories, workDirectory, callback) {
    'use strict';

    function cloneRepository(repository, callback) {
        cloneRepositoryByURLAndName(repository.git_url, repository.name, workDirectory,
            (error, clonedRepository) => {
                if (error) {
                    return callback(error, null);
                }
                Repository.create(clonedRepository, repository, workDirectory, callback);
            });
    }
    async.map(repositories, cloneRepository, callback);
}

module.exports = clone;
