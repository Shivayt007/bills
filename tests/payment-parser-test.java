import com.satraders.billing.PaymentParser;
class PaymentParserTest {
    static void amount(String text,double expected){double actual=PaymentParser.amount(text);if(actual!=expected)throw new AssertionError(text+" -> "+actual+", expected "+expected);}
    public static void main(String[] args){
        amount("Received ₹2,000.50 from Kumar",2000.50);
        amount("Paytm: Kumar paid you Rs. 450",450);
        amount("PhonePe INR 100 received from Ram",100);
        amount("A/c credited INR 500 UPI Ref 123456789012",500);
        amount("You paid ₹500 to Kumar",0);
        amount("₹500 payment pending",0);
        amount("Request for money: received ₹500",0);
        amount("₹500 refunded",0);
        amount("₹500 cashback received",0);
        amount("OTP 123456 received for Rs. 500",0);
        amount("Payment ₹500 failed",0);
        amount("Account credited ₹500 balance ₹3,000",0);
        if(!PaymentParser.reference("UPI Ref: 123456789012").equals("123456789012"))throw new AssertionError("UPI reference");
        System.out.println("Payment parser tests passed");
    }
}
