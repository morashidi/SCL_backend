const assert = require("assert");
const { as, anon, actor, unique } = require("./helpers");
const {
  expectSchema,
  expectPage,
  expectArray,
  expectError,
} = require("./lib/openapi");

const okBody = (res) => {
  assert.ok(
    res.status < 400,
    `expected success, got ${res.status}: ${JSON.stringify(res.body)}`
  );

  return res.body;
};

const isId = (value) => typeof value === "string" && /^[a-f0-9]{24}$/.test(value);

describe("API contract (openapi-1.yaml)", function () {
  let admin;
  let sysAdmin;
  let finance;
  let recruiter;
  let mandoobUser;

  beforeEach(async function () {
    sysAdmin = await actor("system_admin");
    admin = await actor("admin");
    finance = await actor("finance");
    recruiter = await actor("recruiter");
    mandoobUser = await actor("mandoob");
  });

  const seedCompany = async () => {
    const res = await as(admin.accessToken)
      .post("/companies")
      .send({ name: unique("Company ") });

    return okBody(res);
  };

  const seedMandoob = async () => {
    const res = await as(admin.accessToken)
      .post("/mandoobs")
      .send({
        name: "Mahmoud Ali",
        phone: unique("0111"),
        nationalId: unique("2980101"),
        vehicleType: "BICYCLE",
        kind: "MANDOOB",
        cities: ["Cairo"],
        payoutRecipient: {
          recipientName: "Mahmoud Ali",
          accountOrWalletNumber: "01111111111",
          isBigMandoob: false,
        },
      });

    return okBody(res);
  };

  // The contract takes leads in bulk: { leads: [LeadCreate] } -> Lead[].
  const seedLead = async () => {
    const res = await as(recruiter.accessToken)
      .post("/leads")
      .send({ leads: [{ name: "Lead One", phone: unique("0122") }] });

    return okBody(res)[0];
  };

  // ------------------------------------------------------------------ Auth

  describe("Auth", function () {
    it("POST /auth/login returns AuthTokens", async function () {
      const user = await actor("admin", { password: "Secret123!" });
      const res = await anon()
        .post("/auth/login")
        .send({ username: user.user.username, password: "Secret123!" });

      assert.strictEqual(res.status, 200);
      expectSchema("AuthTokens", res.body);
    });

    it("POST /auth/login rejects bad credentials with 401 + Error", async function () {
      const res = await anon()
        .post("/auth/login")
        .send({ username: admin.user.username, password: "wrong" });

      assert.strictEqual(res.status, 401);
      expectError(res.body);
    });

    it("POST /auth/refresh exchanges a refresh token", async function () {
      const res = await anon()
        .post("/auth/refresh")
        .send({ refreshToken: admin.refreshToken });

      assert.strictEqual(res.status, 200);
      expectSchema("AuthTokens", res.body);
    });

    it("POST /auth/refresh refuses an access token", async function () {
      const res = await anon()
        .post("/auth/refresh")
        .send({ refreshToken: admin.accessToken });

      assert.strictEqual(res.status, 401);
    });

    it("GET /auth/me returns the caller as a User", async function () {
      const res = await as(admin.accessToken).get("/auth/me");

      assert.strictEqual(res.status, 200);
      expectSchema("User", res.body);
      assert.strictEqual(res.body.id, admin.id);
      assert.strictEqual(res.body.role, "OWNER_ADMIN");
    });

    it("GET /auth/me requires a token", async function () {
      const res = await anon().get("/auth/me");

      assert.strictEqual(res.status, 401);
      expectError(res.body);
    });

    it("POST /auth/logout returns 204 and kills the token", async function () {
      const res = await as(admin.accessToken).post("/auth/logout");

      assert.strictEqual(res.status, 204);

      const after = await as(admin.accessToken).get("/auth/me");

      assert.strictEqual(after.status, 401);
    });
  });

  // ----------------------------------------------------------------- Users

  describe("Users", function () {
    it("GET /users returns Page & { items: User[] }", async function () {
      const res = await as(admin.accessToken).get("/users");

      assert.strictEqual(res.status, 200);
      expectPage("User", res.body);
    });

    it("POST /users creates a user and returns 201 + User", async function () {
      const res = await as(admin.accessToken)
        .post("/users")
        .send({
          fullName: "New Finance",
          username: unique("fin"),
          password: "Passw0rd!",
          role: "FINANCE",
        });

      assert.strictEqual(res.status, 201);
      expectSchema("User", res.body);
      assert.strictEqual(res.body.role, "FINANCE");
    });

    it("POST /users rejects an unknown role with 422", async function () {
      const res = await as(admin.accessToken)
        .post("/users")
        .send({
          fullName: "Bad Role",
          username: unique("bad"),
          password: "Passw0rd!",
          role: "WIZARD",
        });

      assert.strictEqual(res.status, 422);
      expectError(res.body);
    });

    it("GET /users/{userId} returns a User", async function () {
      const res = await as(admin.accessToken).get(`/users/${finance.id}`);

      assert.strictEqual(res.status, 200);
      expectSchema("User", res.body);
    });

    it("GET /users/{userId} returns 404 for a missing user", async function () {
      const res = await as(admin.accessToken).get(
        "/users/00000000000000000000000a"
      );

      assert.strictEqual(res.status, 404);
      expectError(res.body);
    });

    it("PATCH /users/{userId} updates and returns the User", async function () {
      const res = await as(admin.accessToken)
        .patch(`/users/${finance.id}`)
        .send({ fullName: "Renamed Finance" });

      assert.strictEqual(res.status, 200);
      expectSchema("User", res.body);
      assert.strictEqual(res.body.fullName, "Renamed Finance");
    });

    it("DELETE /users/{userId} returns 204", async function () {
      const target = await actor("mandoob");
      const res = await as(admin.accessToken).delete(`/users/${target.id}`);

      assert.strictEqual(res.status, 204);
    });

    it("GET /users requires authentication", async function () {
      const res = await anon().get("/users");

      assert.strictEqual(res.status, 401);
    });
  });

  // ----------------------------------------------------------------- Roles

  describe("Roles", function () {
    it("GET /roles returns Role[]", async function () {
      const res = await as(admin.accessToken).get("/roles");

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body), "expected a bare array of roles");
      res.body.forEach((role, index) =>
        expectSchema("Role", role, `roles[${index}]`)
      );
    });

    it("POST /roles is restricted to system admins", async function () {
      const res = await as(admin.accessToken)
        .post("/roles")
        .send({ name: "CUSTOM", permissions: ["users.read"] });

      assert.strictEqual(res.status, 403);
      expectError(res.body);
    });

    it("POST /roles answers a declared status for a system admin", async function () {
      const res = await as(sysAdmin.accessToken)
        .post("/roles")
        .send({ name: "CUSTOM", permissions: ["users.read"] });

      assert.ok(
        [201, 501].includes(res.status),
        `expected 201 or 501, got ${res.status}`
      );
    });

    it("PATCH /roles/{roleId} refuses to modify a built-in role", async function () {
      const res = await as(sysAdmin.accessToken)
        .patch("/roles/OWNER_ADMIN")
        .send({ name: "CUSTOM", permissions: ["users.read"] });

      assert.strictEqual(res.status, 403);
      expectError(res.body);
    });

    it("PATCH /roles/{roleId} answers 404 for an unknown role", async function () {
      const res = await as(sysAdmin.accessToken)
        .patch("/roles/00000000000000000000000a")
        .send({ name: "CUSTOM", permissions: ["users.read"] });

      assert.strictEqual(res.status, 404);
      expectError(res.body);
    });
  });

  // ----------------------------------------------------------------- Leads

  describe("Leads", function () {
    it("GET /leads returns Page & { items: Lead[] }", async function () {
      const res = await as(recruiter.accessToken).get("/leads");

      assert.strictEqual(res.status, 200);
      expectPage("Lead", res.body);
    });

    it("POST /leads accepts a bulk batch and returns Lead[]", async function () {
      const res = await as(recruiter.accessToken)
        .post("/leads")
        .send({
          leads: [
            { name: "Ahmed", phone: unique("0100") },
            { name: "Mona", phone: unique("0101") },
          ],
        });

      assert.strictEqual(res.status, 201);
      expectArray("Lead", res.body);
      assert.strictEqual(res.body.length, 2);
    });

    it("POST /leads rejects a body without a leads array", async function () {
      const res = await as(recruiter.accessToken)
        .post("/leads")
        .send({ name: "Ahmed", phone: unique("0100") });

      assert.strictEqual(res.status, 422);
      expectError(res.body);
    });

    it("GET /leads/{leadId} returns a Lead", async function () {
      const lead = await seedLead();
      const res = await as(recruiter.accessToken).get(`/leads/${lead.id}`);

      assert.strictEqual(res.status, 200);
      expectSchema("Lead", res.body);
    });

    it("POST /leads/{leadId}/reschedule returns a Lead", async function () {
      const lead = await seedLead();
      const res = await as(recruiter.accessToken)
        .post(`/leads/${lead.id}/reschedule`)
        .send({ rescheduledAt: new Date(Date.now() + 86400000).toISOString() });

      assert.strictEqual(res.status, 200);
      expectSchema("Lead", res.body);
    });

    it("GET /leads is closed to finance", async function () {
      const res = await as(finance.accessToken).get("/leads");

      assert.strictEqual(res.status, 403);
    });
  });

  // ----------------------------------------------------------------- Calls

  describe("Calls", function () {
    it("GET /calls returns Page & { items: Call[] }", async function () {
      const res = await as(recruiter.accessToken).get("/calls");

      assert.strictEqual(res.status, 200);
      expectPage("Call", res.body);
    });

    it("POST /calls logs a call and returns 201 + Call", async function () {
      const leadId = (await seedLead()).id;
      const res = await as(recruiter.accessToken)
        .post("/calls")
        .send({ leadId, outcome: "INTERESTED", note: "keen" });

      assert.strictEqual(res.status, 201);
      expectSchema("Call", res.body);
    });

    it("POST /calls rejects an unknown outcome with 422", async function () {
      const leadId = (await seedLead()).id;
      const res = await as(recruiter.accessToken)
        .post("/calls")
        .send({ leadId, outcome: "MAYBE" });

      assert.strictEqual(res.status, 422);
      expectError(res.body);
    });

    it("GET /calls/{callId} returns a Call", async function () {
      const leadId = (await seedLead()).id;
      const created = okBody(
        await as(recruiter.accessToken)
          .post("/calls")
          .send({ leadId, outcome: "NO_ANSWER" })
      );
      const res = await as(recruiter.accessToken).get(`/calls/${created.id}`);

      assert.strictEqual(res.status, 200);
      expectSchema("Call", res.body);
    });

    it("PUT /calls/{callId}/ai-review is declared by the contract", async function () {
      const leadId = (await seedLead()).id;
      const created = okBody(
        await as(recruiter.accessToken)
          .post("/calls")
          .send({ leadId, outcome: "NO_ANSWER" })
      );
      const res = await as(recruiter.accessToken)
        .put(`/calls/${created.id}/ai-review`)
        .send({ transcript: "hello", score: 4 });

      assert.notStrictEqual(
        res.status,
        404,
        "PUT /calls/{callId}/ai-review is in openapi-1.yaml but not routed"
      );
    });
  });

  // -------------------------------------------------------------- Mandoobs

  describe("Mandoobs", function () {
    it("GET /mandoobs returns Page & { items: Mandoob[] }", async function () {
      const res = await as(admin.accessToken).get("/mandoobs");

      assert.strictEqual(res.status, 200);
      expectPage("Mandoob", res.body);
    });

    it("POST /mandoobs creates a mandoob", async function () {
      const res = await as(admin.accessToken)
        .post("/mandoobs")
        .send({
          name: "Sayed",
          phone: unique("0155"),
          nationalId: unique("2990202"),
          vehicleType: "SMALL_PICKUP",
          kind: "DRIVER",
          cities: ["Giza"],
        });

      assert.strictEqual(res.status, 201);
      expectSchema("Mandoob", res.body);
    });

    it("POST /mandoobs rejects a bad vehicleType with 422", async function () {
      const res = await as(admin.accessToken)
        .post("/mandoobs")
        .send({
          name: "Sayed",
          phone: unique("0155"),
          nationalId: unique("2990202"),
          vehicleType: "SPACESHIP",
          kind: "MANDOOB",
          cities: ["Giza"],
        });

      assert.strictEqual(res.status, 422);
      expectError(res.body);
    });

    it("GET /mandoobs/{mandoobId} returns a Mandoob", async function () {
      const mandoob = await seedMandoob();
      const res = await as(admin.accessToken).get(`/mandoobs/${mandoob.id}`);

      assert.strictEqual(res.status, 200);
      expectSchema("Mandoob", res.body);
    });

    it("PATCH /mandoobs/{mandoobId} updates a Mandoob", async function () {
      const mandoob = await seedMandoob();
      const res = await as(admin.accessToken)
        .patch(`/mandoobs/${mandoob.id}`)
        .send({ cities: ["Alexandria"] });

      assert.strictEqual(res.status, 200);
      expectSchema("Mandoob", res.body);
    });

    it("GET|POST /mandoobs/{id}/companies links a company", async function () {
      const mandoob = await seedMandoob();
      const company = await seedCompany();

      const created = await as(admin.accessToken)
        .post(`/mandoobs/${mandoob.id}/companies`)
        .send({ companyId: company.id, starId: "S1", username: "m.ali" });

      assert.strictEqual(created.status, 201);
      expectSchema("MandoobCompany", created.body);

      const list = await as(admin.accessToken).get(
        `/mandoobs/${mandoob.id}/companies`
      );

      assert.strictEqual(list.status, 200);
      assert.ok(Array.isArray(list.body.items || list.body));
    });

    it("PATCH|DELETE /mandoobs/{id}/companies/{linkId} round-trips", async function () {
      const mandoob = await seedMandoob();
      const company = await seedCompany();
      const link = okBody(
        await as(admin.accessToken)
          .post(`/mandoobs/${mandoob.id}/companies`)
          .send({ companyId: company.id })
      );

      const patched = await as(admin.accessToken)
        .patch(`/mandoobs/${mandoob.id}/companies/${link.id}`)
        .send({ starId: "S2" });

      assert.strictEqual(patched.status, 200);
      expectSchema("MandoobCompany", patched.body);

      const removed = await as(admin.accessToken).delete(
        `/mandoobs/${mandoob.id}/companies/${link.id}`
      );

      assert.strictEqual(removed.status, 204);
    });

    it("GET /mandoobs/{id}/salaries returns SalaryLine[]", async function () {
      const mandoob = await seedMandoob();
      const res = await as(admin.accessToken).get(
        `/mandoobs/${mandoob.id}/salaries`
      );

      assert.strictEqual(res.status, 200);
      expectArray("SalaryLine", res.body);
    });

    it("GET /mandoobs/{id}/loans returns Loan[]", async function () {
      const mandoob = await seedMandoob();
      const res = await as(admin.accessToken).get(`/mandoobs/${mandoob.id}/loans`);

      assert.strictEqual(res.status, 200);
      expectArray("Loan", res.body);
    });

    it("GET /mandoobs/{id}/deductions returns Deduction[]", async function () {
      const mandoob = await seedMandoob();
      const res = await as(admin.accessToken).get(
        `/mandoobs/${mandoob.id}/deductions`
      );

      assert.strictEqual(res.status, 200);
      expectArray("Deduction", res.body);
    });
  });

  // ------------------------------------------------------------- Companies

  describe("Companies", function () {
    it("GET /companies returns Page & { items: Company[] }", async function () {
      const res = await as(admin.accessToken).get("/companies");

      assert.strictEqual(res.status, 200);
      expectPage("Company", res.body);
    });

    it("POST /companies returns 201 + Company", async function () {
      const res = await as(admin.accessToken)
        .post("/companies")
        .send({ name: unique("Acme ") });

      assert.strictEqual(res.status, 201);
      expectSchema("Company", res.body);
    });

    it("GET /companies/{companyId} returns a Company", async function () {
      const company = await seedCompany();
      const res = await as(admin.accessToken).get(`/companies/${company.id}`);

      assert.strictEqual(res.status, 200);
      expectSchema("Company", res.body);
    });

    it("PATCH /companies/{companyId} updates a Company", async function () {
      const company = await seedCompany();
      const res = await as(admin.accessToken)
        .patch(`/companies/${company.id}`)
        .send({ name: "Renamed Co" });

      assert.strictEqual(res.status, 200);
      expectSchema("Company", res.body);
    });
  });

  // ------------------------------------------------------ Training sessions

  describe("Training sessions", function () {
    const sessionBody = (companyId) => ({
      companyId,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 90,
      requiredStayMinutes: 60,
      zone: { latitude: 30.05, longitude: 31.23, radiusMeters: 120 },
    });

    it("GET /training-sessions returns a page of TrainingSession", async function () {
      const res = await as(admin.accessToken).get("/training-sessions");

      assert.strictEqual(res.status, 200);
      expectPage("TrainingSession", res.body);
    });

    it("POST /training-sessions returns 201 + TrainingSession", async function () {
      const company = await seedCompany();
      const res = await as(admin.accessToken)
        .post("/training-sessions")
        .send(sessionBody(company.id));

      assert.strictEqual(res.status, 201);
      expectSchema("TrainingSession", res.body);
    });

    it("GET /training-sessions/{sessionId} returns a TrainingSession", async function () {
      const company = await seedCompany();
      const session = okBody(
        await as(admin.accessToken)
          .post("/training-sessions")
          .send(sessionBody(company.id))
      );
      const res = await as(admin.accessToken).get(
        `/training-sessions/${session.id}`
      );

      assert.strictEqual(res.status, 200);
      expectSchema("TrainingSession", res.body);
    });

    it("GET|POST /training-sessions/{id}/assignments round-trips", async function () {
      const company = await seedCompany();
      const session = okBody(
        await as(admin.accessToken)
          .post("/training-sessions")
          .send(sessionBody(company.id))
      );
      const mandoob = await seedMandoob();

      const created = await as(admin.accessToken)
        .post(`/training-sessions/${session.id}/assignments`)
        .send({ mandoobId: mandoob.id });

      assert.strictEqual(created.status, 201);
      expectSchema("TrainingAssignment", created.body);

      const list = await as(admin.accessToken).get(
        `/training-sessions/${session.id}/assignments`
      );

      assert.strictEqual(list.status, 200);
      expectArray("TrainingAssignment", list.body);
    });
  });

  // ------------------------------------------------------------ Attendance

  describe("Attendance (declared by the contract)", function () {
    const cases = [
      ["post", "/attendance/call-center", {}],
      ["post", "/attendance/training", {}],
      ["post", "/attendance/locations", {}],
      ["get", "/attendance/locations/live", null],
    ];

    cases.forEach(([method, path, body]) => {
      it(`${method.toUpperCase()} ${path} is routed`, async function () {
        const call = as(admin.accessToken)[method](path);
        const res = body ? await call.send(body) : await call;

        assert.notStrictEqual(
          res.status,
          404,
          `${method.toUpperCase()} ${path} is in openapi-1.yaml but not routed`
        );
      });
    });
  });

  // ------------------------------------------------------------- Blocklist

  describe("Blocklist", function () {
    it("GET /blocklist returns a page of BlockEntry", async function () {
      const res = await as(admin.accessToken).get("/blocklist");

      assert.strictEqual(res.status, 200);
      expectPage("BlockEntry", res.body);
    });

    it("POST /blocklist returns 201 + BlockEntry", async function () {
      const res = await as(admin.accessToken)
        .post("/blocklist")
        .send({ phone: unique("0109"), reason: "fraud" });

      assert.strictEqual(res.status, 201);
      expectSchema("BlockEntry", res.body);
    });

    it("GET /blocklist/check reports block status", async function () {
      const phone = unique("0109");

      await as(admin.accessToken).post("/blocklist").send({ phone, reason: "x" });

      const res = await as(admin.accessToken).get(`/blocklist/check?phone=${phone}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(typeof res.body.blocked, "boolean");
      assert.strictEqual(res.body.blocked, true);
    });

    it("POST /blocklist/{entryId}/unblock returns a BlockEntry", async function () {
      const entry = okBody(
        await as(admin.accessToken)
          .post("/blocklist")
          .send({ phone: unique("0109"), reason: "x" })
      );
      const res = await as(admin.accessToken)
        .post(`/blocklist/${entry.id}/unblock`)
        .send({ reason: "cleared" });

      assert.strictEqual(res.status, 200);
      expectSchema("BlockEntry", res.body);
      assert.strictEqual(res.body.active, false);
    });
  });

  // ----------------------------------------------------------------- Loans

  describe("Loans", function () {
    const openLoan = async () => {
      const mandoob = await seedMandoob();
      const loan = okBody(
        await as(admin.accessToken)
          .post("/loans")
          .send({ mandoobId: mandoob.id, principal: 3000, installmentsCount: 3 })
      );

      return { mandoob, loan };
    };

    it("GET /loans returns a page of Loan", async function () {
      const res = await as(admin.accessToken).get("/loans");

      assert.strictEqual(res.status, 200);
      expectPage("Loan", res.body);
    });

    it("POST /loans returns 201 + Loan", async function () {
      const mandoob = await seedMandoob();
      const res = await as(admin.accessToken)
        .post("/loans")
        .send({ mandoobId: mandoob.id, principal: 3000, installmentsCount: 3 });

      assert.strictEqual(res.status, 201);
      expectSchema("Loan", res.body);
      assert.strictEqual(res.body.status, "PENDING");
    });

    it("GET /loans/{loanId} returns a Loan", async function () {
      const { loan } = await openLoan();
      const res = await as(admin.accessToken).get(`/loans/${loan.id}`);

      assert.strictEqual(res.status, 200);
      expectSchema("Loan", res.body);
    });

    it("POST /loans/{loanId}/decision approves a loan", async function () {
      const { loan } = await openLoan();
      const res = await as(finance.accessToken)
        .post(`/loans/${loan.id}/decision`)
        .send({ decision: "APPROVE", reason: "ok" });

      assert.strictEqual(res.status, 200);
      expectSchema("Loan", res.body);
      assert.strictEqual(res.body.status, "APPROVED");
    });

    it("POST /loans/{loanId}/decision is closed to recruiters", async function () {
      const { loan } = await openLoan();
      const res = await as(recruiter.accessToken)
        .post(`/loans/${loan.id}/decision`)
        .send({ decision: "APPROVE" });

      assert.strictEqual(res.status, 403);
    });
  });

  // ------------------------------------------------------------ Deductions

  describe("Deductions", function () {
    it("GET /deductions returns a page of Deduction", async function () {
      const res = await as(admin.accessToken).get("/deductions");

      assert.strictEqual(res.status, 200);
      expectPage("Deduction", res.body);
    });

    it("POST /deductions returns 201 + Deduction", async function () {
      const mandoob = await seedMandoob();
      const res = await as(finance.accessToken)
        .post("/deductions")
        .send({ mandoobId: mandoob.id, type: "DAMAGE", amount: 150, reason: "box" });

      assert.strictEqual(res.status, 201);
      expectSchema("Deduction", res.body);
    });

    it("PATCH /deductions/{deductionId} updates a Deduction", async function () {
      const mandoob = await seedMandoob();
      const created = okBody(
        await as(finance.accessToken)
          .post("/deductions")
          .send({ mandoobId: mandoob.id, type: "LOSS", amount: 90 })
      );
      const res = await as(finance.accessToken)
        .patch(`/deductions/${created.id}`)
        .send({ amount: 120 });

      assert.strictEqual(res.status, 200);
      expectSchema("Deduction", res.body);
      assert.strictEqual(res.body.amount, 120);
    });

    it("POST /deductions is closed to recruiters", async function () {
      const mandoob = await seedMandoob();
      const res = await as(recruiter.accessToken)
        .post("/deductions")
        .send({ mandoobId: mandoob.id, type: "DAMAGE", amount: 10 });

      assert.strictEqual(res.status, 403);
    });
  });

  // -------------------------------------------------------------- Salaries

  describe("Salaries", function () {
    it("GET /salaries/imports returns a page of SalaryImport", async function () {
      const res = await as(admin.accessToken).get("/salaries/imports");

      assert.strictEqual(res.status, 200);
      expectPage("SalaryImport", res.body);
    });

    it("GET /salaries/lines returns a page of SalaryLine", async function () {
      const res = await as(admin.accessToken).get("/salaries/lines");

      assert.strictEqual(res.status, 200);
      expectPage("SalaryLine", res.body);
    });

    it("POST /salaries/lines returns 201 + SalaryLine", async function () {
      const mandoob = await seedMandoob();
      const company = await seedCompany();
      const res = await as(finance.accessToken)
        .post("/salaries/lines")
        .send({
          mandoobId: mandoob.id,
          companyId: company.id,
          period: "2026-01",
          totalSalary: 5200,
        });

      assert.strictEqual(res.status, 201);
      expectSchema("SalaryLine", res.body);
    });

    it("POST /salaries/lines rejects a malformed period with 422", async function () {
      const mandoob = await seedMandoob();
      const company = await seedCompany();
      const res = await as(finance.accessToken)
        .post("/salaries/lines")
        .send({
          mandoobId: mandoob.id,
          companyId: company.id,
          period: "January 2026",
          totalSalary: 100,
        });

      assert.strictEqual(res.status, 422);
      expectError(res.body);
    });

    it("GET /salaries/imports/{importId} answers 404 for a missing import", async function () {
      const res = await as(admin.accessToken).get(
        "/salaries/imports/00000000000000000000000a"
      );

      assert.strictEqual(res.status, 404);
      expectError(res.body);
    });

    it("POST /salaries/imports/{importId}/commit answers 404 for a missing import", async function () {
      const res = await as(finance.accessToken).post(
        "/salaries/imports/00000000000000000000000a/commit"
      );

      assert.strictEqual(res.status, 404);
      expectError(res.body);
    });

    it("POST /salaries/imports requires a sheet", async function () {
      const res = await as(finance.accessToken).post("/salaries/imports").send({});

      assert.strictEqual(res.status, 422);
      expectError(res.body);
    });
  });

  // -------------------------------------------------------------- Payments

  describe("Payments", function () {
    const payableMandoob = async () => {
      const mandoob = await seedMandoob();
      const company = await seedCompany();

      await as(finance.accessToken).post("/salaries/lines").send({
        mandoobId: mandoob.id,
        companyId: company.id,
        period: "2026-01",
        totalSalary: 5000,
      });

      return mandoob;
    };

    it("GET /payments returns a page of Payment", async function () {
      const res = await as(admin.accessToken).get("/payments");

      assert.strictEqual(res.status, 200);
      expectPage("Payment", res.body);
    });

    it("POST /payments returns 201 + Payment", async function () {
      const mandoob = await payableMandoob();
      const res = await as(finance.accessToken)
        .post("/payments")
        .send({ mandoobId: mandoob.id, period: "2026-01", method: "CASH" });

      assert.strictEqual(res.status, 201);
      expectSchema("Payment", res.body);
      assert.strictEqual(res.body.grossAmount, 5000);
    });

    it("POST /payments rejects a duplicate period with 409", async function () {
      const mandoob = await payableMandoob();
      const body = { mandoobId: mandoob.id, period: "2026-01", method: "CASH" };

      await as(finance.accessToken).post("/payments").send(body);

      const res = await as(finance.accessToken).post("/payments").send(body);

      assert.strictEqual(res.status, 409);
      expectError(res.body);
    });

    it("POST /payments/payout returns 202 + { payments: Payment[] }", async function () {
      const mandoob = await payableMandoob();

      const res = await as(finance.accessToken)
        .post("/payments/payout")
        .send({ period: "2026-01", mandoobIds: [mandoob.id] });

      assert.strictEqual(res.status, 202);
      expectArray("Payment", res.body.payments, "payments");
      assert.strictEqual(res.body.payments.length, 1);
    });

    it("POST /payments/payout requires mandoobIds", async function () {
      const res = await as(finance.accessToken)
        .post("/payments/payout")
        .send({ period: "2026-01" });

      assert.strictEqual(res.status, 422);
      expectError(res.body);
    });

    it("GET /payments/{paymentId} returns a Payment", async function () {
      const mandoob = await payableMandoob();
      const created = okBody(
        await as(finance.accessToken)
          .post("/payments")
          .send({ mandoobId: mandoob.id, period: "2026-01", method: "CASH" })
      );
      const res = await as(admin.accessToken).get(`/payments/${created.id}`);

      assert.strictEqual(res.status, 200);
      expectSchema("Payment", res.body);
    });

    it("POST /payments/{paymentId}/screenshot requires a file", async function () {
      const mandoob = await payableMandoob();
      const created = okBody(
        await as(finance.accessToken)
          .post("/payments")
          .send({ mandoobId: mandoob.id, period: "2026-01", method: "CASH" })
      );
      const res = await as(finance.accessToken)
        .post(`/payments/${created.id}/screenshot`)
        .send({});

      assert.strictEqual(res.status, 422);
      expectError(res.body);
    });

    it("POST /payments is closed to recruiters", async function () {
      const mandoob = await payableMandoob();
      const res = await as(recruiter.accessToken)
        .post("/payments")
        .send({ mandoobId: mandoob.id, period: "2026-01", method: "CASH" });

      assert.strictEqual(res.status, 403);
    });
  });

  // ------------------------------------------------------------- Dashboard

  describe("Dashboard", function () {
    it("GET /dashboard/summary matches DashboardSummary", async function () {
      const res = await as(admin.accessToken).get("/dashboard/summary");

      assert.strictEqual(res.status, 200);
      expectSchema("DashboardSummary", res.body);
    });

    it("GET /dashboard/agent-leaderboard returns AgentPerformance[]", async function () {
      const res = await as(admin.accessToken).get("/dashboard/agent-leaderboard");

      assert.strictEqual(res.status, 200);

      const items = Array.isArray(res.body) ? res.body : res.body.items;

      assert.ok(Array.isArray(items), "expected an array of agents");
      items.forEach((item, index) =>
        expectSchema("AgentPerformance", item, `agents[${index}]`)
      );
    });

    it("GET /dashboard/summary is closed to recruiters", async function () {
      const res = await as(recruiter.accessToken).get("/dashboard/summary");

      assert.strictEqual(res.status, 403);
    });
  });

  // --------------------------------------------------------- Cross-cutting

  describe("Cross-cutting contract rules", function () {
    const guarded = [
      ["get", "/users"],
      ["get", "/leads"],
      ["get", "/calls"],
      ["get", "/mandoobs"],
      ["get", "/companies"],
      ["get", "/training-sessions"],
      ["get", "/blocklist"],
      ["get", "/loans"],
      ["get", "/deductions"],
      ["get", "/salaries/lines"],
      ["get", "/payments"],
      ["get", "/dashboard/summary"],
      ["get", "/roles"],
    ];

    guarded.forEach(([method, path]) => {
      it(`${method.toUpperCase()} ${path} answers 401 without a token`, async function () {
        const res = await anon()[method](path);

        assert.strictEqual(res.status, 401);
        expectError(res.body);
      });
    });

    // GET /users is scoped by rank rather than blocked outright: a caller only
    // sees roles below their own, plus themselves. The lowest rank therefore
    // sees exactly one row - their own account.
    it("a mandoob's user listing is scoped to themselves", async function () {
      const res = await as(mandoobUser.accessToken).get("/users");

      assert.strictEqual(res.status, 200);
      expectPage("User", res.body);
      assert.strictEqual(res.body.items.length, 1);
      assert.strictEqual(res.body.items[0].id, mandoobUser.id);
    });

    it("a recruiter cannot see admin accounts in the listing", async function () {
      const res = await as(recruiter.accessToken).get("/users?pageSize=100");

      assert.strictEqual(res.status, 200);

      const roles = res.body.items.map((item) => item.role);

      assert.ok(
        !roles.includes("OWNER_ADMIN") && !roles.includes("SYSTEM_ADMIN"),
        `a recruiter should not see admins, saw: ${roles.join(", ")}`
      );
    });

    it("unknown routes answer 404 with an Error body", async function () {
      const res = await as(admin.accessToken).get("/nope");

      assert.strictEqual(res.status, 404);
      expectError(res.body);
    });

    it("malformed JSON answers 400", async function () {
      const res = await as(admin.accessToken)
        .post("/companies")
        .set("Content-Type", "application/json")
        .send("{ oops");

      assert.strictEqual(res.status, 400);
      expectError(res.body);
    });

    it("list endpoints honour page/pageSize", async function () {
      const res = await as(admin.accessToken).get("/users?page=2&pageSize=1");

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.page, 2);
      assert.strictEqual(res.body.pageSize, 1);
    });

    it("ids are returned as 24-char hex strings", async function () {
      const company = await seedCompany();

      assert.ok(isId(company.id), `expected an ObjectId string, got ${company.id}`);
    });
  });
});
