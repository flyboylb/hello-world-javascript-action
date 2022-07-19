const { setFailed, getInput, setOutput, core } = require("@actions/core");
const { context } = require("@actions/github");
const { exec } = require("@actions/exec");
const semver = require("semver");

function run() {
    try {
        let prerelease = getInput("prerelease", { required: false });
        let mine = "";
        let tagprefix = getInput("buildtagprefix", { required: true });
        console.log(`tagprefix is ${tagprefix}`);
        let currentVersionTag = getCurrentTag();

        if (currentVersionTag) {
            console.log(`Already at version ${currentVersionTag}, skipping...`);
            setOutput("version", currentVersionTag);
            return;
        }

        let nextVersion = getNextVersionTag(tagprefix,{ prerelease });
        console.log(`nextv is ${nextVersion}`);
        core.exportVariable('release_tag', nextVersion);
      
    } catch (error) {
        setFailed(error.message);
    }
}

run();

function getCurrentTag() {
    exec("git fetch --tags");

    // First Check if there is already a release tag at the head...
    let currentTags =  execGetOutput(`git tag --points-at ${context.sha}`);

    return currentTags.map(processVersion).filter(Boolean)[0];
}

 function getNextVersionTag( tagprefix , { prerelease }) {
    let allTags = execGetOutput("git tag");

    let previousVersionTags = allTags
        .map(processVersion)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    return prerelease
        ? getPrereleaseVersion(previousVersionTags, prerelease)
        : getNextDateVersion(tagprefix, previousVersionTags);
}

function getNextDateVersion(tagprefix, previousVersionTags) {
    let { year, month, day } = getDateParts();
    let newVersionParts = [`${year}`, `${month}`, `${day}`, 0];

    while (_tagExists(newVersionParts, previousVersionTags)) {
        newVersionParts[3]++;
    }
    let versionnumber = newVersionParts.join(".");
    console.log()
    console.log(`Tag prefix in getnextDateV is ${tagprefix}`);
    let outputvar = `${tagprefix}-${versionnumber}`;

    return outputvar;
}

function getPrereleaseVersion(previousVersionTags, prerelease) {
    let nextVersion = getNextDateVersion(previousVersionTags);
    let nextVersionParts = nextVersion.split(".");

    let prereleaseVersion = 0;
    while (
        _tagExists(nextVersionParts, previousVersionTags, [
            prerelease,
            prereleaseVersion,
        ])
    ) {
        prereleaseVersion++;
    }

    return `${nextVersion}-${prerelease}.${prereleaseVersion}`;
}

function _tagExists(tagParts, previousVersionTags, prereleaseParts) {
    let newTag = tagParts.join(".");

    if (prereleaseParts) {
        let [prerelease, prereleaseVersion] = prereleaseParts;
        newTag = `${newTag}-${prerelease}.${prereleaseVersion}`;
    }

    return previousVersionTags.find((tag) => tag === newTag);
}

function processVersion(version) {
    if (!semver.valid(version)) {
        return false;
    }

    let {
        major,
        minor,
        patch,
        prerelease,
        version: parsedVersion,
    } = semver.parse(version);

    let { year: currentYear, month: currentMonth, day: currentDay } = getDateParts();

    if (major !== currentYear || minor !== currentMonth) {
        return false;
    }

    return parsedVersion;
}

function getDateParts() {
    let date = new Date();
    let year = date.getUTCFullYear().toString().substr(-2) * 1;
    let month = date.getUTCMonth() + 1;
    let day = date.getDate();
 
    return { year, month, day };
}

function execGetOutput(command) {
    let collectedOutput = [];
    let collectedErrorOutput = [];

    let options = {
        listeners: {
            stdout: (data) => {
                let output = data.toString().split("\n");
                collectedOutput = collectedOutput.concat(output);
            },
            stderr: (data) => {
                let output = data.toString().split("\n");
                collectedErrorOutput = collectedErrorOutput.concat(output);
            },
        },
    };

    try {
        exec(command, [], options);
    } catch (error) {
        throw new Error(collectedErrorOutput);
    }

    return collectedOutput;
}