// Limit PostgREST request bursts across all CEAC screens in one browser.
// Authentication and storage traffic is deliberately left untouched.
export function createBoundedRestFetch(fetcher,baseUrl,maxConcurrent=5){
  const restRoot=String(baseUrl||"").replace(/\/+$/,"")+"/rest/v1/";
  const limit=Math.max(1,Math.floor(maxConcurrent));
  const pending=[];
  let active=0;
  const aborted=()=>Object.assign(new Error("Database request cancelled while queued."),{name:"AbortError"});

  function launch(){
    while(active<limit&&pending.length){
      const job=pending.shift();
      job.signal?.removeEventListener("abort",job.onAbort);
      if(job.signal?.aborted){job.reject(aborted());continue;}
      active++;
      Promise.resolve().then(()=>fetcher(job.input,job.init)).then(job.resolve,job.reject)
        .finally(()=>{active--;launch();});
    }
  }

  return (input,init)=>{
    const url=typeof input==="string"?input:input?.url||input?.href||"";
    if(!url.startsWith(restRoot))return fetcher(input,init);
    const signal=init?.signal||input?.signal;
    if(signal?.aborted)return Promise.reject(aborted());
    return new Promise((resolve,reject)=>{
      const job={input,init,signal,resolve,reject,onAbort:null};
      job.onAbort=()=>{
        const index=pending.indexOf(job);
        if(index<0)return; // Already started: the native fetch owns abort.
        pending.splice(index,1);
        reject(aborted());
      };
      signal?.addEventListener("abort",job.onAbort,{once:true});
      pending.push(job);
      launch();
    });
  };
}
