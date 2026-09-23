-- Database Functions for Textweaver Business Logic

-- Confirm a pending payment: credit user, record purchase, update payment status
CREATE OR REPLACE FUNCTION confirm_payment(p_payment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_content_id UUID;
  v_amount INT;
  v_status TEXT;
BEGIN
  -- Lock and read the payment row
  SELECT user_id, content_id, amount_kip, status
  INTO v_user_id, v_content_id, v_amount, v_status
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF v_status != 'pending' THEN
    RETURN json_build_object('error', 'Payment is not pending. Current status: ' || v_status);
  END IF;

  -- Credit the user's balance (add the amount to existing balance)
  INSERT INTO user_balances (user_id, balance_credits)
  VALUES (v_user_id, v_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance_credits = user_balances.balance_credits + v_amount,
      updated_at = now();

  -- Record the purchase
  INSERT INTO purchases (user_id, content_id)
  VALUES (v_user_id, v_content_id)
  ON CONFLICT (user_id, content_id) DO NOTHING;

  -- Mark payment as confirmed
  UPDATE payments SET status = 'confirmed' WHERE id = p_payment_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Reject a payment
CREATE OR REPLACE FUNCTION reject_payment(p_payment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE payments SET status = 'rejected' WHERE id = p_payment_id AND status = 'pending';
  RETURN json_build_object('success', true);
END;
$$;

-- Create a pending payment (called when user clicks "I've paid")
CREATE OR REPLACE FUNCTION create_pending_payment(p_content_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_price INT;
  v_payment_id UUID;
BEGIN
  v_user_id := auth.uid();

  SELECT price_kip INTO v_price FROM content WHERE id = p_content_id;

  INSERT INTO payments (user_id, content_id, amount_kip, status)
  VALUES (v_user_id, p_content_id, v_price, 'pending')
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;
