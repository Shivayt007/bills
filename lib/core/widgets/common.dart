import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../theme/app_theme.dart';

String moneyLabel(num value) => '₹${value.toStringAsFixed(2)}';

/// Presentation only. Keep ISO date keys in Firestore and date comparisons.
String displayDate(Object? value) {
  if (value == null || '$value'.trim().isEmpty) return '—';
  if (value is DateTime) return DateFormat('dd MMM yyyy').format(value);
  final date = DateTime.tryParse('$value');
  return date == null ? '$value' : DateFormat('dd MMM yyyy').format(date);
}

class AppPageWidth extends StatelessWidget {
  const AppPageWidth({super.key, required this.child, this.maxWidth = 760});
  final Widget child;
  final double maxWidth;
  @override Widget build(BuildContext context) => Align(alignment: Alignment.topCenter,
    child: ConstrainedBox(constraints: BoxConstraints(maxWidth: maxWidth), child: child));
}

class AppSurface extends StatelessWidget {
  const AppSurface({super.key, required this.child,
    this.padding = const EdgeInsets.all(AppSpace.md), this.shadow = false});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool shadow;
  @override Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(color: AppPalette.of(context).surface,
      borderRadius: BorderRadius.circular(AppRadius.card),
      border: Border.all(color: AppPalette.of(context).border),
      boxShadow: shadow && Theme.of(context).brightness == Brightness.light ? AppShadows.card : null), child: child);
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, this.color = AppColors.teal, this.icon});
  final String label;
  final Color color;
  final IconData? icon;
  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(color: (Theme.of(context).brightness == Brightness.dark ? AppPalette.of(context).subtle : color.withValues(alpha: .1)), borderRadius: BorderRadius.circular(99)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      if (icon != null) ...[Icon(icon, size: 14, color: Theme.of(context).brightness == Brightness.dark ? AppPalette.of(context).ink : color), const SizedBox(width: 4)],
      Text(label, style: TextStyle(color: Theme.of(context).brightness == Brightness.dark ? AppPalette.of(context).ink : color, fontSize: 11, fontWeight: FontWeight.w800)),
    ]));
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title,{super.key,this.trailing}); final String title; final Widget? trailing;
  @override Widget build(BuildContext context)=>Padding(padding:const EdgeInsets.fromLTRB(2,AppSpace.lg,2,AppSpace.sm),child:Row(children:[Expanded(child:Text(title,style:Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight:FontWeight.w800))),if(trailing!=null)trailing!]));
}
class StatCard extends StatelessWidget {
  const StatCard({super.key,required this.label,required this.value,required this.icon,this.color=AppColors.teal}); final String label,value; final IconData icon; final Color color;
  @override Widget build(BuildContext context)=>AppSurface(child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[Icon(icon,color:Theme.of(context).brightness==Brightness.dark?(color==AppColors.green?AppPalette.of(context).positive:AppPalette.of(context).accent):color),const SizedBox(height:AppSpace.sm),FittedBox(fit:BoxFit.scaleDown,alignment:Alignment.centerLeft,child:Text(value,maxLines:1,style:Theme.of(context).textTheme.titleLarge)),const SizedBox(height:AppSpace.xxs),Text(label,maxLines:2,style:Theme.of(context).textTheme.bodySmall)]));
}
class EmptyState extends StatelessWidget { const EmptyState({super.key,required this.title,required this.description,this.icon=Icons.inbox_outlined}); final String title,description; final IconData icon; @override Widget build(BuildContext context)=>Padding(padding:const EdgeInsets.all(AppSpace.xl),child:Column(mainAxisSize:MainAxisSize.min,children:[Icon(icon,size:42,color:AppPalette.of(context).accent),const SizedBox(height:AppSpace.sm),Text(title,textAlign:TextAlign.center,style:Theme.of(context).textTheme.titleMedium),const SizedBox(height:AppSpace.xs),Text(description,textAlign:TextAlign.center,style:Theme.of(context).textTheme.bodySmall)])); }
class PillAction extends StatelessWidget { const PillAction({super.key,required this.label,required this.icon,required this.onPressed}); final String label; final IconData icon; final VoidCallback onPressed; @override Widget build(BuildContext context)=>FilledButton.tonalIcon(onPressed:onPressed,icon:Icon(icon),label:Text(label)); }
