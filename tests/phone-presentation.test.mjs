import test from "node:test";
import assert from "node:assert/strict";
import {phonePresentationMetrics} from "../src/lib/phonePresentation.js";

test("installed iPhone stays in handset presentation even with a 980px layout viewport", () => {
  const phone = phonePresentationMetrics({
    screen: {width:390,height:844},
    innerWidth:980,
    visualViewport:{width:390},
    navigator:{userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",maxTouchPoints:5},
  });
  assert.deepEqual(phone,{phone:true,width:390});
});

test("desktop user-agent mode on a touch phone still uses physical handset width", () => {
  const phone = phonePresentationMetrics({
    screen:{width:414,height:896},
    innerWidth:980,
    visualViewport:{width:414},
    navigator:{userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X)",maxTouchPoints:5},
  });
  assert.deepEqual(phone,{phone:true,width:414});
});

test("iPad retains the approved laptop navigation, including portrait mode", () => {
  for (const [width,height] of [[834,1194],[1194,834],[768,1024]]) {
    const result=phonePresentationMetrics({
      screen:{width,height},
      innerWidth:width,
      visualViewport:{width},
      navigator:{userAgent:"Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",maxTouchPoints:5},
    });
    assert.deepEqual(result,{phone:false,width:null});
  }
});

test("ordinary desktop and narrow desktop windows do not pretend to be iPhones", () => {
  for(const innerWidth of [390,1440]) {
    const result=phonePresentationMetrics({
      screen:{width:1440,height:900},
      innerWidth,visualViewport:{width:innerWidth},
      navigator:{userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X)",maxTouchPoints:0},
    });
    assert.deepEqual(result,{phone:false,width:null});
  }
});
