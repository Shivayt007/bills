import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

String moneyLabel(num value) => '₹${value.toStringAsFixed(2)}';

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title,{super.key,this.trailing}); final String title; final Widget? trailing;
  @override Widget build(BuildContext context)=>Padding(padding:const EdgeInsets.fromLTRB(2,24,2,12),child:Row(children:[Expanded(child:Text(title,style:Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight:FontWeight.w800))),if(trailing!=null)trailing!]));
}
class StatCard extends StatelessWidget {
  const StatCard({super.key,required this.label,required this.value,required this.icon,this.color=AppColors.teal}); final String label,value; final IconData icon; final Color color;
  @override Widget build(BuildContext context)=>Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Icon(icon,color:color),const SizedBox(height:14),Text(value,style:Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight:FontWeight.w800)),const SizedBox(height:4),Text(label,style:Theme.of(context).textTheme.bodySmall?.copyWith(color:AppColors.gray))])));
}
class EmptyState extends StatelessWidget { const EmptyState({super.key,required this.title,required this.description,this.icon=Icons.inbox_outlined}); final String title,description; final IconData icon; @override Widget build(BuildContext context)=>Padding(padding:const EdgeInsets.all(32),child:Column(children:[Icon(icon,size:42,color:AppColors.paleBlue),const SizedBox(height:12),Text(title,style:Theme.of(context).textTheme.titleMedium),const SizedBox(height:6),Text(description,textAlign:TextAlign.center,style:Theme.of(context).textTheme.bodySmall)])); }
class PillAction extends StatelessWidget { const PillAction({super.key,required this.label,required this.icon,required this.onPressed}); final String label; final IconData icon; final VoidCallback onPressed; @override Widget build(BuildContext context)=>FilledButton.tonalIcon(onPressed:onPressed,icon:Icon(icon),label:Text(label)); }
