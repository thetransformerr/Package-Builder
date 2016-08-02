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

module.exports = { getLargest: getLargest, getFromTag: getFromTag, asString: asString };

// Version is represented by major/minor tuple (without patch)
const nullVersion = { major: -1, minor: -1}

function getLargest(tags, repoName) {
    if (tags.length == 0) {
        return nullVersion;
    }

    function isVersionTag(tag) {
        if (!/^(\d+)\.(\d+)\.(\d+)$/.test(tag)) {
            console.warn(`tag of ${repoName} does not match version format: ${tag}`);
            return false
        }
        return true
    }

    return tags.filter(isVersionTag).map(getFromTag).reduce(maximal);
}

function getFromTag(tag) {
    const versionComponents = tag.split('.');
    return { major: parseInt(versionComponents[0]), minor: parseInt(versionComponents[1]) }
}

function maximal(tuple1, tuple2) {
    if (tuple1.major != tuple2.major) {
        return tuple1.major > tuple2.major? tuple1: tuple2;

    }
    return tuple1.minor > tuple2.minor? tuple1: tuple2;
}

function asString(version) {
    return `${version.major}.${version.minor}`;
}
