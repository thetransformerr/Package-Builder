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

module.exports = {getPackageAsJSON: getPackageAsJSON, updateDependencies: updateDependencies};

const exec = require('child_process').exec;
const async = require('async');
const replace = require('replace');
const semver = require('semver');

function getPackageAsJSON(repositoryDirectory, callback) {
    const swiftDumpPackageCommand = `swift package dump-package --input ${repositoryDirectory}/Package.swift`;
    exec(swiftDumpPackageCommand, function (error, stdout, stderr) {
        var packageJSON = null
        if (error) {
            callback(error, null);
            return;
        }
        if (stderr) {
            console.warn(stderr);
        }

        packageJSON = JSON.parse(stdout);

        console.log(`package name for ${repositoryDirectory} is ${packageJSON.name}`);
        callback(null, packageJSON);
    });
}

function updateDependencies(repositoryDirectory, packageJSON, versions, callback) {
    console.log(`update dependencies in ${repositoryDirectory}`);

    if (packageJSON.dependencies.length == 0) {
        return callback(null);
    }

    async.eachSeries(packageJSON.dependencies, function(dependency, callback) {
        const newVersion = versions[dependency.url];
        if (newVersion) {
            return updateDependency(repositoryDirectory, dependency.url, newVersion, callback);
        }
        callback(null);
    }, callback);
}

function updateDependency(repositoryDirectory, dependencyURL, version, callback) {
    const major = semver.major(version);
    const minor = semver.minor(version);

    console.log(`updating dependency of ${dependencyURL} to version ${version}, major ${major}, minor ${minor}`);
    replace({
        regex: '\\.Package\\(url: \\"' + dependencyURL + '\\", majorVersion: [0-9]+, minor: [0-9]+\\)',
        replacement: '.Package (url: "' + dependencyURL + '", majorVersion: ' + major + ', minor: ' + minor + ')',
        paths: [repositoryDirectory + '/Package.swift'],
        recursive: false,
        silent: true,
    });

    verifyThePackageWasUpdated(repositoryDirectory, dependencyURL, version, callback);
}

function verifyThePackageWasUpdated(repositoryDirectory, dependencyURL, version, callback) {
    getPackageAsJSON(repositoryDirectory, function(error, packageJSON) {
        if (error) {
            callback(error);
        }
        if (hasDependencyWithVersions(packageJSON, dependencyURL, version)) {
            callback(null);
        } else {
            callback(`Did not manage to update Package.swift in ${repositoryDirectory}.\n` +
                     'Verify that the dependency is in format .Package(url: <https url>,  majorVersion: <major>, minor: <minor>), exactly without redundant whitespace.');
        }
    });
}

function hasDependencyWithVersions(packageJSON, dependencyURL, version) {
    return packageJSON.dependencies.some(dependency =>
        dependency.url === dependencyURL && dependency.version.lowerBound === version);
}
