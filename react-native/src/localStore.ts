import AsyncStorage from '@react-native-async-storage/async-storage';
import {Data,EMPTY} from './domain';
const KEY='sa-native-isolated-ledger-v1';
export async function loadLocal():Promise<Data>{
 const raw=await AsyncStorage.getItem(KEY);
 if(!raw)return {bills:[],customers:[],inventory:[],notes:[]};
 const data=JSON.parse(raw) as Data;
 return {bills:Array.isArray(data.bills)?data.bills:[],customers:Array.isArray(data.customers)?data.customers:[],
 inventory:Array.isArray(data.inventory)?data.inventory:[],notes:Array.isArray(data.notes)?data.notes:[],customBills:data.customBills||[],slips:data.slips||[],challans:data.challans||[],settings:data.settings||[],backupBusiness:data.backupBusiness,backupExtra:data.backupExtra};
}
export async function saveLocal(data:Data){await AsyncStorage.setItem(KEY,JSON.stringify(data));}
export async function clearLocal(){await AsyncStorage.removeItem(KEY);}
