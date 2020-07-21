const fs = require("fs");
const path = require("path");
const config = JSON.parse(fs.readFileSync("config.json"));
const testrail = require("./testrail").createClient(config);
const moment = require("moment-timezone");
const parser = require("fast-xml-parser");
const _ = require("lodash");
var tests = { results: [] };

const basePath = "C:\\Users\\green\\Desktop\\projects\\aqa-js\\output";
const files = fs.readdirSync(basePath).filter((f) => f.includes(".xml"));
for (const file of files) {
  const data = fs.readFileSync(path.join(basePath, file)).toString();
  const json = parser.parse(data, {
    attributeNamePrefix: "_",
    ignoreAttributes: false,
    parseAttributeValue: true,
  });
  const testCases = json["ns2:test-suite"]["test-cases"]["test-case"];
  if (Array.isArray(testCases)) {
    for (const testCase of testCases) {
      compute(testCase);
    }
  } else {
    compute(testCases);
  }
}

function compute(testCase) {
  const matches = testCase.name.match(/C\d{4,}/g);
  if (matches != null) {
    const ids = matches.map((m) => m.replace("C", ""));
    ids.forEach((id) => {
      const elapsed = Math.round((testCase._stop - testCase._start) / 1000);
      const data = {
        case_id: id,
        elapsed: elapsed === 0 ? "1s" : `${elapsed}s`,
        comment: `This test case has ${testCase._status}.`,
      };
      const duplicate = tests.results.find((t) => t.case_id === id);
      if (duplicate != undefined && duplicate.status_id === 5) {
        data.comment = `This test case has ${testCase._status} after retry.`;
      }
      if (testCase._status === "pending") return;
      if (testCase._status === "passed") data.status_id = 1;
      if (testCase._status === "failed") {
        data.status_id = 5;
        data.comment += `\nReason: ${testCase.failure.message}`;
      }
      tests.results.push(data);
    });
  }
}

async function submit(tests) {
  const run = await testrail.addRun(config.projectId, {
    suite_id: config.suiteId,
    name: `Automation run on ${moment()
      .tz("America/Denver")
      .format("YYYY-MM-DD h:mm")}`,
    include_all: false,
  });
  await testrail.updateRun(run.id, {
    case_ids: tests.results.map((t) => t.case_id),
  });
  await testrail.addResultsForCases(run.id, tests);
  return { run: run };
}

submit(tests).then((response) =>
  console.log(JSON.stringify(response, null, 2))
);