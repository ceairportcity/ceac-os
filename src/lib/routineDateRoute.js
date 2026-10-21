/** A dated Work deep link is navigation context, never proof or authority. */
export function validRoutineDate(value) {
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const parsed=new Date(value+"T00:00:00Z");
 return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value?value:null;
}
