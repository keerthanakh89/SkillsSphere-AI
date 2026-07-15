import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import JobApplication from "../JobApplication.js";

const createValidJobApplication = () => ({
  job: new mongoose.Types.ObjectId(),
  applicant: new mongoose.Types.ObjectId(),
});

test("JobApplication - accepts hired status in status and statusHistory", () => {
  const application = new JobApplication({
    ...createValidJobApplication(),
    status: "hired",
    statusHistory: [{ status: "hired", comment: "Candidate hired" }],
  });

  const errors = application.validateSync();

  assert.equal(errors, undefined, "Hired status should be valid");
  assert.equal(application.status, "hired");
  assert.equal(application.statusHistory.at(-1).status, "hired");
});
