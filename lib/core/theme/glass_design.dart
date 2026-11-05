import 'dart:ui';
import 'package:flutter/material.dart';
import 'app_theme.dart';

/// Shared visual layer. Business values and navigation live in their features.
abstract final class GlassColors {
  static const primary = Color(0xFF05637F);
  static const secondary = Color(0xFFA2BBCF);
  static const neutral = Color(0xFFAAAAAA);
  static const ink = Color(0xFF14313E);
  static const canvasTop = Color(0xFFE6F9FC);
  static const canvasBottom = Color(0xFFF5FBFD);
  static const pending = Color(0xFF97511B);
  static const received = Color(0xFF086B51);
  static const dueToday = Color(0xFF805B08);
}

class GlassBackdrop extends StatelessWidget {
  const GlassBackdrop({super.key, required this.child});
  final Widget child;
  @override Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Stack(children: [
      Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: dark ? const [Color(0xFF0B1D29),Color(0xFF142D3A),Color(0xFF101A25)]
            : const [GlassColors.canvasTop,Color(0xFFDCF3F7),GlassColors.canvasBottom])))),
      Positioned(top: -130, right: -105, width: 320, height: 320,
        child: _Glow(color: dark ? const Color(0x3333A6BA) : const Color(0x9999E5EE))),
      Positioned(top: 260, left: -150, width: 300, height: 300,
        child: _Glow(color: dark ? const Color(0x223D9BB0) : const Color(0x887ABCCA))),
      Positioned(bottom: 80, right: -110, width: 270, height: 270,
        child: _Glow(color: dark ? const Color(0x224AB1C0) : const Color(0x778FD6E2))),
      child,
    ]);
  }
}
class _Glow extends StatelessWidget {
  const _Glow({required this.color});
  final Color color;
  @override Widget build(BuildContext context) => IgnorePointer(child: DecoratedBox(
    decoration: BoxDecoration(shape: BoxShape.circle,
      gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]))));
}

class GlassCard extends StatelessWidget {
  const GlassCard({super.key, required this.child,
    this.padding = const EdgeInsets.all(18), this.blur = false,
    this.borderRadius = 22, this.onTap});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final bool blur;
  final double borderRadius;
  final VoidCallback? onTap;
  @override Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final shape = BorderRadius.circular(borderRadius);
    final surface = Container(padding: padding,
      decoration: BoxDecoration(
        borderRadius: shape,
        gradient: LinearGradient(begin: Alignment.topLeft,end: Alignment.bottomRight,
          colors: dark ? const [Color(0xDD203D4D),Color(0xCC192D3C)]
            : const [Color(0xEFFFFFFF),Color(0xBFE9F7FA)]),
        border: Border.all(color: dark ? const Color(0x557BB5C5) : Colors.white,
          width: 1.2),
        boxShadow: [BoxShadow(color: dark ? const Color(0x35000000)
          : const Color(0x1C367C91),blurRadius: 18,offset: const Offset(0,7))]),
      child: child);
    final content = blur ? ClipRRect(borderRadius: shape,
      child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 8,sigmaY: 8),child:surface)) : surface;
    if (onTap == null) return content;
    return Semantics(button:true,child:Material(color:Colors.transparent,
      child:InkWell(borderRadius:shape,onTap:onTap,child:content)));
  }
}

class GlassPillButton extends StatelessWidget {
  const GlassPillButton({super.key,required this.label,required this.onPressed,
    this.icon, this.secondary = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool secondary;
  @override Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final textColor = secondary ? AppPalette.of(context).ink : Colors.white;
    return Opacity(opacity:onPressed == null ? .55 : 1,
      child:Material(color:Colors.transparent,child:Ink(
        decoration:BoxDecoration(borderRadius:BorderRadius.circular(99),
          gradient:LinearGradient(begin:Alignment.topLeft,end:Alignment.bottomRight,
            colors:secondary ? (dark ? const [Color(0xFF294858),Color(0xFF203744)]
              : const [Color(0xEFFFFFFF),Color(0xCFE5F4F8)])
              : const [Color(0xFF1686A2),GlassColors.primary,Color(0xFF07485F)]),
          border:Border.all(color:secondary ? (dark ? const Color(0x777CB4C4) : Colors.white)
            : const Color(0xB3A9F2FC)),
          boxShadow:const [BoxShadow(color:Color(0x24346E83),blurRadius:10,offset:Offset(0,4))]),
        child:InkWell(onTap:onPressed,borderRadius:BorderRadius.circular(99),
          child:ConstrainedBox(constraints:const BoxConstraints(minHeight:48),
            child:Padding(padding:const EdgeInsets.symmetric(horizontal:18,vertical:11),
              child:Row(mainAxisSize:MainAxisSize.min,mainAxisAlignment:MainAxisAlignment.center,
                children:[if(icon!=null)...[Icon(icon,size:19,color:textColor),const SizedBox(width:7)],
                  Flexible(child:Text(label,maxLines:1,overflow:TextOverflow.ellipsis,
                    style:TextStyle(color:textColor,fontWeight:FontWeight.w800,fontSize:14)))],)))))));
  }
}

enum GlassStatus { pending, received, dueToday }
class GlassStatusChip extends StatelessWidget {
  const GlassStatusChip({super.key,required this.status});
  final GlassStatus status;
  @override Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final label = switch(status) {
      GlassStatus.pending => 'Pending',
      GlassStatus.received => 'Received',
      GlassStatus.dueToday => 'Due Today',
    };
    final foreground = switch(status) {
      GlassStatus.pending => dark ? const Color(0xFFFFC18F) : GlassColors.pending,
      GlassStatus.received => dark ? const Color(0xFF7CE9BF) : GlassColors.received,
      GlassStatus.dueToday => dark ? const Color(0xFFFFD87E) : GlassColors.dueToday,
    };
    final background = foreground.withValues(alpha: dark ? .16 : .12);
    return Container(padding:const EdgeInsets.symmetric(horizontal:10,vertical:6),
      decoration:BoxDecoration(color:background,borderRadius:BorderRadius.circular(99),
        border:Border.all(color:foreground.withValues(alpha:.25))),
      child:Text(label,style:TextStyle(color:foreground,fontWeight:FontWeight.w800,fontSize:11)));
  }
}

class GlassBottomNavigation extends StatelessWidget {
  const GlassBottomNavigation({super.key,required this.index,required this.onSelected});
  final int index;
  final ValueChanged<int> onSelected;
  static const labels = ['Home','Bills','Reports','More'];
  static const icons = [Icons.home_outlined,Icons.receipt_long_outlined,
    Icons.bar_chart_outlined,Icons.grid_view_outlined];
  @override Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final p = AppPalette.of(context);
    return SafeArea(top:false,child:Container(
      margin:const EdgeInsets.fromLTRB(12,4,12,8),padding:const EdgeInsets.all(5),
      decoration:BoxDecoration(borderRadius:BorderRadius.circular(28),
        color:dark ? const Color(0xE5223B4B) : const Color(0xE9F4FCFE),
        border:Border.all(color:dark ? const Color(0x6678B6C7) : Colors.white,width:1.3),
        boxShadow:const [BoxShadow(color:Color(0x2534697B),blurRadius:18,offset:Offset(0,5))]),
      child:Row(children:List.generate(4,(i) {
        final selected = index == i;
        return Expanded(child:Semantics(selected:selected,button:true,label:labels[i],
          child:Material(color:Colors.transparent,child:InkWell(
            borderRadius:BorderRadius.circular(24),onTap:()=>onSelected(i),
            child:Container(height:56,decoration:BoxDecoration(
              borderRadius:BorderRadius.circular(24),
              gradient:selected ? const LinearGradient(colors:[Color(0xFF1688A3),GlassColors.primary]) : null,
              border:selected ? Border.all(color:const Color(0x99B5F4FB)) : null),
              child:Column(mainAxisAlignment:MainAxisAlignment.center,children:[
                Icon(icons[i],size:22,color:selected?Colors.white:p.ink),
                Text(labels[i],maxLines:1,style:TextStyle(fontSize:11,fontWeight:FontWeight.w800,
                  color:selected?Colors.white:p.ink)),
              ]))))));
      })),
    ));
  }
}
