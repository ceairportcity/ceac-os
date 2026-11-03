// Keep global notification polling bounded under slow or failing databases.
export function notificationRetryDelay(failures=1){
  const exponent=Math.max(0,Math.min(4,Math.trunc(failures)-1));
  return Math.min(360000,30000*(2**exponent));
}

// Run each source once, preserve its result slot, and cap total concurrency.
// A failed optional source cannot prevent another source from being checked.
export async function runNotificationTasks(tasks=[],concurrency=3){
  if(!tasks.length)return [];
  const results=new Array(tasks.length);
  let cursor=0;
  const workers=Math.min(tasks.length,Math.max(1,Math.floor(concurrency)));
  await Promise.all(Array.from({length:workers},async()=>{
    while(cursor<tasks.length){
      const index=cursor++;
      try{results[index]=await tasks[index]();}
      catch(error){results[index]={data:null,error};}
    }
  }));
  return results;
}
