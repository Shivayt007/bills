import {NativeModules,Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Data,TODAY,money} from './domain';
import {reminders,reminderData} from './reminders';
export type Candidate={id:string;amount:number;reference:string;source:string;text:string;receivedAt:number;dismissed?:boolean};
export const paymentCandidates=async():Promise<Candidate[]>=>NativeModules.SATradersPayments?JSON.parse(await NativeModules.SATradersPayments.candidates()).filter((x:Candidate)=>!x.dismissed):[];
export const openPaymentAccess=()=>NativeModules.SATradersPayments?.openSettings();
export const dismissCandidate=(id:string)=>NativeModules.SATradersPayments?.dismiss(id);
export async function scheduleReminders(data:Data){
 const permission=await Notifications.requestPermissionsAsync();if(!permission.granted)throw Error('Notification permission denied');
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('rental-reminders',{name:'Rental reminders',importance:Notifications.AndroidImportance.DEFAULT});
 await Notifications.cancelAllScheduledNotificationsAsync();
 const jobs=reminders(data);
 if(NativeModules.SATradersPayments){await NativeModules.SATradersPayments.syncReminders(JSON.stringify(reminderData(data)),true);await AsyncStorage.setItem('sa-reminders-enabled','true');return jobs.length;}
 const summary=jobs.filter(r=>r.category!=='upcoming');
 await Notifications.scheduleNotificationAsync({content:{title:'S.A Traders rental review',body:summary.length+' pending / due bills · '+money(summary.reduce((s,r)=>s+r.amount,0))+'. Open the app to refresh current balances.'},trigger:{type:Notifications.SchedulableTriggerInputTypes.DAILY,hour:9,minute:0,channelId:'rental-reminders'}});
 for(const r of jobs.filter(r=>r.category==='upcoming')){const date=new Date(r.date+'T09:00:00');await Notifications.scheduleNotificationAsync({content:{title:r.bill.name+' · Bill #'+r.bill.bill_no,body:'Rental cycle begins today. Estimated '+money(r.amount)+'. Open to verify.'},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date,channelId:'rental-reminders'}});}
 const raw=await AsyncStorage.getItem('sa-reminder-history');const history=raw?JSON.parse(raw):[];await AsyncStorage.setItem('sa-reminder-history',JSON.stringify([{at:new Date().toISOString(),count:jobs.length},...history].slice(0,100)));
 return jobs.length;
}

export async function refreshBackgroundReminders(data:Data){if(await AsyncStorage.getItem('sa-reminders-enabled')==='true'&&NativeModules.SATradersPayments)await NativeModules.SATradersPayments.syncReminders(JSON.stringify(reminderData(data)),true);}
export async function disableReminders(){await Notifications.cancelAllScheduledNotificationsAsync();await AsyncStorage.setItem('sa-reminders-enabled','false');if(NativeModules.SATradersPayments)await NativeModules.SATradersPayments.syncReminders('[]',false);}
export const reminderHistory=async()=>NativeModules.SATradersPayments?JSON.parse(await NativeModules.SATradersPayments.reminderHistory()):[];
