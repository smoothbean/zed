import axios from 'axios';
import fs from 'fs';

const cryptoAddress = '0xf02Ec44Bd0624d5DF1AC25aa5E39f73587Ef303A';
const token = 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJjcnlwdG9maWVsZF9hcGkiLCJleHAiOjE2NzAzMzc4NTQsImlhdCI6MTY2NzkxODY1NCwiaXNzIjoiY3J5cHRvZmllbGRfYXBpIiwianRpIjoiZjkzMTFmZDQtNmM1Yy00N2I3LWIwZTYtNmMyYTYzZjJhOGUzIiwibmJmIjoxNjY3OTE4NjUzLCJzdWIiOnsiZXh0ZXJuYWxfaWQiOiIzYTU0MDExZi04MjQ1LTQwMWYtYTkxMy02MzVkMjk1MDg0OWQiLCJpZCI6Mjc2MTgwLCJwdWJsaWNfYWRkcmVzcyI6IjB4ZjAyRWM0NEJkMDYyNGQ1REYxQUMyNWFhNUUzOWY3MzU4N0VmMzAzQSIsInN0YWJsZV9uYW1lIjoiU3RhYmwifSwidHlwIjoiYWNjZXNzIn0.kXC9Wla9493mg3TWcCL_7VRVZ9863XEDOXL1UUjbf0xHIPaKvaeEy5g0GRmjH8EeDZKTt6ThwbBDUhNhn6oDFg';

const horseResultData = {};

const getRaceResultsQuery = (after = false) => {
  return {
      "query": `{
          getRaceResults(input: {
              onlyMyRacehorses: true,
          }, ${after ? `after: "${after}"` : ''}) {
            edges {
              cursor
              node {
                country
                city
                name
                length
                startTime
                fee
                raceId
                weather
                status
                class
                prizePool {
                  first
                  second
                  third
                }
                horses {
                  horseId
                  finishTime
                  finalPosition
                  name
                  gate
                  ownerAddress
                  bloodline
                  gender
                  breedType
                  gen
                  coat
                  hexColor
                  imgUrl
                  class
                  stableName
                }
              }
            }
            pageInfo {
              startCursor
              endCursor
              hasNextPage
              hasPreviousPage
            }
          }
        }`
  }
}

const myHorsesRes1 = await axios.get(
  `https://api.zed.run/api/v1/horses/get_user_horses?public_address=${cryptoAddress}&offset=0&horse_name=&sort_by=horse_name_asc`
);
const myHorsesRes2 = await axios.get(
  `https://api.zed.run/api/v1/horses/get_user_horses?public_address=${cryptoAddress}&offset=10&horse_name=&sort_by=horse_name_asc`
);

const myHorseIds = [
  ...myHorsesRes1.data.map(horse => horse.horse_id),
  ...myHorsesRes2.data.map(horse => horse.horse_id),
];

const resultFile = await fs.readFileSync('./src/results.json', "utf8");
const resultFiledata = JSON.parse((Buffer.from(resultFile)).toString());

// let cursor = resultFiledata?.cursor ? resultFiledata.cursor : false;
let cursor = false;

console.log(cursor);

while(true) {
  // { data: { getRaceResults: { edges: [Array], pageInfo: [Object] } } }
  const res = await axios.post(
    'https://zed-ql.zed.run/graphql',
    getRaceResultsQuery(cursor),
    {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }
  );

  const { pageInfo, edges } = res.data.data.getRaceResults;

  edges.forEach(edge => {
    const race = edge.node;
    const myHorse = race.horses.find(horse => myHorseIds.includes(horse.horseId));
    const finalPosition = Number(myHorse.finalPosition);

    if (Object.keys(horseResultData).includes(String(myHorse.horseId))) {
      if (Object.keys(horseResultData[myHorse.horseId]).includes(String(race.length))) {
        horseResultData[myHorse.horseId][race.length].push(finalPosition);
      } else {
        horseResultData[myHorse.horseId][race.length] = [finalPosition];
      }
    } else {
      horseResultData[myHorse.horseId] = {
        [race.length]: [finalPosition],
      };
    }
  });

  if (pageInfo.hasNextPage) {
    console.log(`Last Cursor: ${pageInfo.endCursor}`);
    cursor = pageInfo.endCursor
  } else {
    console.log('Fin.');
    break;
  }

  // break;
}

let rankings = [];

Object.keys(horseResultData).forEach((horseId) => {
  const horseResults = horseResultData[horseId];

  let totalRaceCount = 0;
  let horseRaceData = [];

  Object.keys(horseResults).forEach((raceLength) => {
    const positions = horseResults[raceLength];

    const sum = positions.reduce((a, b) => a + b, 0);
    const avg = (sum / positions.length) || 0;

    horseRaceData.push({
      count: positions.length,
      avg,
      raceLength,
    });

    totalRaceCount += positions.length;
  });

  horseRaceData.sort((a, b) => a.avg - b.avg);

  rankings.push({
    horseId,
    hawkuSrc: `https://www.hawku.com/details/zed_run/zed_horse/${horseId}`,
    horseRaceData,
  });
});

rankings = rankings.map(ranking => {
  let sumAvg = 0;
  let sumCount = 0;

  ranking.horseRaceData.forEach((data) => {
    sumAvg += data.avg;
    sumCount += data.count;
  });

  return {
    sumAvg,
    sumCount,
    weight: sumAvg / sumCount,
    ...ranking,
  }
});
// rankings.sort((a, b) => (a.sumAvg - b.sumAvg));
rankings.sort((a, b) => (a.weight - b.weight));

rankings.forEach(ranking => console.log(ranking));

fs.writeFileSync(
  './src/results.json',
  JSON.stringify({cursor, rankings}, null, 2),
  'utf-8',
);
