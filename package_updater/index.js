var GitHubApi = require("github");
var Git = require("nodegit");
var mkdirp = require("mkdirp");
var async = require('async');

var github = new GitHubApi({
    // optional
    debug: true,
    protocol: "https",
    host: "api.github.com", // should be api.github.com for GitHub
    headers: {
        "user-agent": "My-Cool-GitHub-App" // GitHub is happy with a unique user agent
    },
    Promise: require('bluebird'),
    followRedirects: false, // default: true; there's currently an issue with non-get redirects, so allow ability to disable follow-redirects
    timeout: 5000
});

var format = require('date-format');
var dateString = format.asString('MM_dd_yy', new Date())
var workDirectory = 'KituraPackagesToUpdate_' + dateString

mkdirp(workDirectory, function(err) {
    if (err) {
        console.error(err)
        return
    }
    github.repos.getForOrg({
        org: "IBM-Swift",
        type: "all",
        per_page: 300
    }, function(err, repos) {
        var i = 0;
        var name = "";
        async.each(repos, function(repo, callback) {
            name = repo.name
            if (!name.startsWith('Kitura')) {
                callback()
                return;
            }
            console.log('cloning repo ' + name);   
            Git.Clone(repo.git_url, workDirectory + '/' + name).then(function(cloned) {
                console.log('cloned repo' + cloned.path())
                callback()
            })
        }, function() {
            console.log('finished cloning repos')
        });
    });
});
