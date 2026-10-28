import test from 'node:test';
import assert from 'node:assert/strict';
import {expenseAmountMinor} from '../src/lib/expenseAmount.js';

test('expense values retain exact cents and valid grouping, including zero',()=>{
 for(const [input,want] of [['0',0],['0.01',1],['0.29',29],['12.5',1250],['2,500.50',250050],[' 42.09 ',4209]])assert.equal(expenseAmountMinor(input),want,input);
});
test('expense values reject rather than rewrite negatives, text, malformed decimals and overflow',()=>{
 for(const input of ['-25','GHS 25','1,2','1.2.3','1.234','',' ','NaN','Infinity','9007199254740992'])assert.equal(expenseAmountMinor(input),null,input);
});
