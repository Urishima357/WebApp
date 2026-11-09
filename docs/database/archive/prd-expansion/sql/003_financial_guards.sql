-- Additional database-level guards. Never edit checksummed applied migrations.
DELIMITER $$
CREATE TRIGGER guard_transaction_final_transition BEFORE UPDATE ON transactions
FOR EACH ROW
BEGIN
  IF OLD.status='FINAL' AND NEW.status NOT IN ('FINAL','CANCELLED') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cannot downgrade a final transaction';
  END IF;
  IF OLD.status IN ('FINAL','CANCELLED') AND NOT (
    OLD.id <=> NEW.id AND OLD.corrects_transaction_id <=> NEW.corrects_transaction_id
    AND OLD.created_by <=> NEW.created_by AND OLD.created_at <=> NEW.created_at
    AND OLD.finalized_by <=> NEW.finalized_by
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Final document identity is immutable';
  END IF;
END$$
CREATE TRIGGER guard_transaction_waiting_snapshot BEFORE UPDATE ON transactions
FOR EACH ROW
BEGIN
  IF OLD.status='AWAITING_PAYMENT' AND NOT (
    OLD.number <=> NEW.number AND OLD.transaction_type <=> NEW.transaction_type
    AND OLD.document_type <=> NEW.document_type AND OLD.corrects_transaction_id <=> NEW.corrects_transaction_id
    AND OLD.customer_id <=> NEW.customer_id AND OLD.location_id <=> NEW.location_id
    AND OLD.work_order_id <=> NEW.work_order_id AND OLD.showroom_inventory_id <=> NEW.showroom_inventory_id
    AND OLD.subtotal <=> NEW.subtotal AND OLD.total <=> NEW.total
    AND OLD.discount_type <=> NEW.discount_type AND OLD.discount_input <=> NEW.discount_input
    AND OLD.discount_amount <=> NEW.discount_amount AND OLD.discount_reason <=> NEW.discount_reason
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Payment request snapshot is locked';
  END IF;
  IF OLD.status='AWAITING_PAYMENT' AND NEW.status='DRAFT' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Cancel pending payment document before replacing it';
  END IF;
END$$
CREATE TRIGGER guard_tx_lines_locked_insert BEFORE INSERT ON transaction_lines
FOR EACH ROW
BEGIN
  IF EXISTS(SELECT 1 FROM transactions WHERE id=NEW.transaction_id AND status='AWAITING_PAYMENT') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Payment request lines are locked';
  END IF;
END$$
CREATE TRIGGER guard_tx_lines_locked_update BEFORE UPDATE ON transaction_lines
FOR EACH ROW
BEGIN
  IF EXISTS(SELECT 1 FROM transactions WHERE id IN (OLD.transaction_id,NEW.transaction_id) AND status='AWAITING_PAYMENT') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Payment request lines are locked';
  END IF;
END$$
CREATE TRIGGER guard_tx_lines_locked_delete BEFORE DELETE ON transaction_lines
FOR EACH ROW
BEGIN
  IF EXISTS(SELECT 1 FROM transactions WHERE id=OLD.transaction_id AND status='AWAITING_PAYMENT') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Payment request lines are locked';
  END IF;
END$$
CREATE TRIGGER guard_item_base_unit BEFORE UPDATE ON items
FOR EACH ROW
BEGIN
  IF OLD.base_unit_id<>NEW.base_unit_id AND EXISTS(SELECT 1 FROM stock_movements WHERE item_id=OLD.id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Base unit cannot change after stock movement';
  END IF;
END$$
DELIMITER ;
