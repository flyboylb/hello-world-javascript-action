const { setFailed, getInput, setOutput } = require("@actions/core");
const { context } = require("@actions/github");
const { exec } = require("@actions/exec");
const semver = require("semver");

async function run() {
    try {
      
        let currentVersionTag = await getCurrentTag();

        if (currentVersionTag) {
            console.log(`Already at version ${currentVersionTag}, skipping...`);
            setOutput("version", currentVersionTag);
            return;
        }

        let nextVersion = await getNextVersionTag({ prerelease });
        console.log(`Next version: ${nextVersion}`);

      
    } catch (error) {
        setFailed(error.message);
    }
}

run();

async function getCurrentTag() {
    await exec("git fetch --tags");

    // First Check if there is already a release tag at the head...
    let currentTags = await execGetOutput(`git tag --points-at ${context.sha}`);

    return currentTags.map(processVersion).filter(Boolean)[0];
}

async function getNextVersionTag({ prerelease }) {
    let allTags = await execGetOutput("git tag");

    let previousVersionTags = allTags
        .map(processVersion)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    return prerelease
        ? getPrereleaseVersion(previousVersionTags, prerelease)
        : getNextDateVersion(previousVersionTags);
}

function getNextDateVersion(previousVersionTags) {
    let { year, month } = getDateParts();
    let newVersionParts = [`${year}`, `${month}`, 0];

    while (_tagExists(newVersionParts, previousVersionTags)) {
        newVersionParts[2]++;
    }

    return newVersionParts.join(".");
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

    let { year: currentYear, month: currentMonth } = getDateParts();

    if (major !== currentYear || minor !== currentMonth) {
        return false;
    }

    return parsedVersion;
}

function getDateParts() {
    let date = new Date();
    let year = date.getUTCFullYear().toString().substr(-2) * 1;
    let month = date.getUTCMonth() + 1;

    return { year, month };
}

async function execGetOutput(command) {
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
        await exec(command, [], options);
    } catch (error) {
        throw new Error(collectedErrorOutput);
    }

    return collectedOutput;
}