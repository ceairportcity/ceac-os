import RoleWorkforceMap from './RoleWorkforceMap';

// The Executive uses the same HR-roster map evidence as Compliance and HR,
// without receiving any private employee roster columns.
export default function ExecutiveWorkforceToday({me}){
 return <RoleWorkforceMap me={me} roleLabel="Executive" peopleLabel="people"/>;
}
