const core = require('@actions/core');
const github = require('@actions/github');
const { exec } = require("@actions/exec");
try {
  // `who-to-greet` input defined in action metadata file
  const nameToGreet = core.getInput('who-to-greet');
    console.log(`Hello ${nameToGreet}!`);

    const time = (new Date()).toTimeString();

  core.setOutput("time", time);
  // Get the JSON webhook payload for the event that triggered the workflow
  //const payload = JSON.stringify(github.context.payload, undefined, 2)
  getCurrentTag();

}
catch (error)
{
  core.setFailed(error.message);
}

 function getCurrentTag() {
    exec("git fetch --tags");

    // First Check if there is already a release tag at the head...
    let currentTags = execGetOutput(`git tag --points-at ${context.sha}`);
    console.log(`Current Tags: ${currentTags}`);
    return currentTags.map(processVersion).filter(Boolean)[0];
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