const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4020, () => {
      console.log("Server Running at http://localhost:4000/");
    });
  } catch {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

const convertStateDbObjectToResponseObject = (dbObj) => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  };
};
const convertDistrictDbObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
function AuthenticationToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", AuthenticationToken, async (request, response) => {
  const getallInStates = `
            SELECT
                *
            FROM
                state;`;
  const statesQuery = await db.all(getallInStates);
  response.send(
    statesQuery.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

app.get("/states/:stateId/", AuthenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateWithId = `
            SELECT
                *
            FROM 
                state
            WHERE 
                state_id = '${stateId}';`;
  const stateQuery = await db.get(getStateWithId);
  response.send(convertStateDbObjectToResponseObject(stateQuery));
});

app.post("/districts/", AuthenticationToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictDetails = `
            INSERT INTO 
                district(district_name,state_id,cases,cured,active,deaths)
            VALUES (
                '${districtName}',
                '${stateId}',
                '${cases}',
                '${cured}',
                '${active}',
                '${deaths}');`;
  const dbResponse = await db.run(postDistrictDetails);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  AuthenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictsQuery = `
    SELECT
      *
    FROM
     district
    WHERE
      district_id = '${districtId}';`;
    const district = await db.get(getDistrictsQuery);
    response.send(convertDistrictDbObjectToResponseObject(district));
  }
);
app.delete(
  "/districts/:districtId/",
  AuthenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictWithId = `
            DELETE FROM
                district
            WHERE 
                district_id = '${districtId}';`;
    const deletedTbl = await db.run(deleteDistrictWithId);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  AuthenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistricts = `
            UPDATE
                district
            SET 
                district_name = '${districtName}',
                state_id = '${stateId}',
                cases = '${cases}',
                cured = '${cured}',
                active = '${active}',
                deaths = '${deaths}'
            WHERE
                district_id = '${districtId}';`;
    const updatedDistricts = await db.run(updateDistricts);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  AuthenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotalstatsDetails = `
            SELECT 
                SUM(cases),
                SUM(cured),
                SUM(active),
                SUM(deaths)
            FROM 
                district
           
            WHERE 
                state_id = ${stateId};`;
    const stats = await db.get(getTotalstatsDetails);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

// To Get All list of Districts
app.get("/districts/", async (request, response) => {
  const getAllDistricts = `
            SELECT 
                *
            FROM 
                district;`;
  const districts = await db.all(getAllDistricts);
  response.send(districts);
});

module.exports = app;
