const e = {
  parameter: { action: "registerStaff", liffToken: "real-token" },
  postData: { contents: '{"action":"registerStaff","lastName":"Iwasa","firstName":"LINE","lineUserId":"U7375015ea7c5380e2c8da827eb8d3f08"}' }
};

const method = e.postData ? 'POST' : 'GET';
let postData = null;
if (method === 'POST') {
  try {
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter;
    }
  } catch (f) {
    postData = e.parameter;
  }
}

const action = (method === 'POST' ? (postData && postData.action || e.parameter.action) : e.parameter.action) || 'health';
let path = '/' + action;

console.log("Raw Action:", postData && postData.action || e.parameter.action);
console.log("Resolved Path:", path);
console.log("Payload:", postData);
