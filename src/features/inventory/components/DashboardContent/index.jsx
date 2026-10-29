import InventoryWarning from '../InventoryWarning/index.jsx';
import InventoryContent from '../InventoryContent/index.jsx';

export default function DashboardContent(props) {
  return (
    <>
      {Boolean(props.inventory.errors.length) && !props.inventory.loading && (
        <InventoryWarning errors={props.inventory.errors} />
      )}
      <InventoryContent {...props} />
    </>
  );
}
