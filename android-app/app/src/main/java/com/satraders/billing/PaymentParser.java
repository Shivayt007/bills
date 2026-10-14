package com.satraders.billing;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Conservative suggestions only; never authorises or records a payment. */
public final class PaymentParser {
    private static final Pattern AMOUNT=Pattern.compile("(?:₹|\\bINR\\b|\\bRs\\.?)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)(?![0-9.])",Pattern.CASE_INSENSITIVE);
    private static final Pattern REF=Pattern.compile("(?:UPI\\s*(?:ref(?:erence)?|txn|transaction)?|UTR|ref(?:erence)?(?:\\s*(?:no|number))?|transaction\\s*(?:id|no))\\s*[:.#-]?\\s*([0-9]{10,22})\\b",Pattern.CASE_INSENSITIVE);
    public static double amount(String text){
        if(text==null)return 0;
        String lower=text.toLowerCase(Locale.ROOT);
        if(lower.matches("(?s).*(?:\\botp\\b|verification code|collect request|payment request|request for money|requested|refund|reversed|failed|declined|pending|processing|debited|you paid|you sent|paid to|sent to|cashback|offer|recharge|credited to.*beneficiary).*"))return 0;
        if(!lower.matches("(?s).*(?:\\breceived\\b|\\bcredited\\b|\\bpaid you\\b).*"))return 0;
        Matcher match=AMOUNT.matcher(text);double amount=0;int count=0;
        while(match.find()){double value;try{value=Double.parseDouble(match.group(1).replace(",",""));}catch(Exception e){return 0;}if(value>0){amount=value;count++;}}
        // Multiple amounts (e.g. available balance) are ambiguous: require manual entry.
        return count==1&&Double.isFinite(amount)&&amount<=100000000?amount:0;
    }
    public static String reference(String text){Matcher m=REF.matcher(text);return m.find()?m.group(1):"";}
    private PaymentParser(){}
}
