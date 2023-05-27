import { applySeccompProfileToWorkload, deleteSeccompPolicy, updateSeccompPolicy } from './api';
import FindRootWorkload, { parseSeccompAnnotations } from './helper';
import checkIcon from '@iconify/icons-mdi/check';
import infoIcon from '@iconify/icons-mdi/info-circle-outline';

const pluginLib = window.pluginLib;
const { Link, SimpleTable, EditorDialog, ConfirmDialog, SectionBox, SectionHeader } =
  pluginLib.CommonComponents;
const { Grid, Button, Typography, Checkbox, Box, Tooltip, IconButton } = pluginLib.MuiCore;
const React = pluginLib.React;
const { useParams } = pluginLib.ReactRouter;
const { useSnackbar } = pluginLib.Notistack;
const { Icon } = pluginLib.Iconify;

interface PolicyTableViewGenerator {
  title: string;
  setIsEditorOpen: (data: boolean) => any;
  setEditorValue: (data: any) => any;
  tableData: any[];
  handlePolicyDelete: (policiesToDelete: any, resetPolicySelect: () => any) => void;
  shouldHaveApply?: boolean;
  callback?: (...args: any) => void;
}

function PolicyTableViewGenerator(props: PolicyTableViewGenerator) {
  const { namespace } = useParams();
  const {
    title,
    setIsEditorOpen,
    setEditorValue,
    tableData,
    handlePolicyDelete,
    shouldHaveApply,
    callback,
  } = props;
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [selectedPolicies, setSelectedPolicies] = React.useState(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
  const policiesToConsider = tableData?.filter((policy: any) =>
    selectedPolicies?.includes(policy?.metadata.uid)
  );
  const podsToConsider = policiesToConsider
    ?.map((policy: any) => parseSeccompAnnotations(policy, 'pod', namespace))
    .join(', ');
  const workflows = policiesToConsider?.map(
    (policy: any) => `${policy.rootWorkload}(${policy.rootWorkloadName})`
  );

  function generateDialogDescription() {
    return `These seccomp policies were generated for pods ${podsToConsider} which belongs to workflow
      ${workflows?.join(', ')}.
      Do you want to patch these workflows to use these policies?
      Warning: This will restart the pods`;
  }
  function handlePolicyApply() {
    setIsConfirmDialogOpen(true);
  }

  function handlePolicyMerge() {
    setIsConfirmDialogOpen(true);
  }

  function handleCheckBox(e: any, data: any) {
    const policies = selectedPolicies ? [...selectedPolicies] : [];
    if (e.target.checked) {
      policies.push(data);
    } else {
      policies.splice(policies.indexOf(data), 1);
    }
    setSelectedPolicies(policies);
  }

  function handleConfirm() {
    const standalonePods = policiesToConsider
      .filter((policy: any) => policy?.rootWorkload === 'Pod')
      .map((policy: any) => policy?.metadata.name);
    const massagedPoliciesToConsider = policiesToConsider.filter(
      (policy: any) => policy?.rootWorkload !== 'Pod'
    );
    massagedPoliciesToConsider.forEach((policy: any) => {
      applySeccompProfileToWorkload(policy.rootWorkloadName, namespace, policy.rootWorkload, {
        type: 'Localhost',
        profile: policy.status.localhostProfile,
      })
        .then(() => {
          enqueueSnackbar(`policy ${policy?.metadata?.name} successfully applied`, {
            variant: 'success',
          });
          setSelectedPolicies(null);
          callback(policy);
        })
        .catch((error: Error) => {
          console.log(error);
        });
    });
    if (standalonePods && standalonePods.length !== 0) {
      enqueueSnackbar(
        `policies ${standalonePods.join(
          ', '
        )} couldn't be applied as they do not belong to a workload`,
        {
          action: key => (
            <Button onClick={() => closeSnackbar(key)} color="secondary">
              Ok
            </Button>
          ),
          persist: true,
        }
      );
    }
    setSelectedPolicies(null);
  }

  return (
    <Box py={2}>
      <ConfirmDialog
        open={isConfirmDialogOpen}
        description={generateDialogDescription()}
        onConfirm={handleConfirm}
        handleClose={() => {
          setIsConfirmDialogOpen(false);
          setSelectedPolicies(null);
        }}
      />
      {selectedPolicies?.length > 0 && (
        <Grid container spacing={2}>
          {shouldHaveApply && (
            <Grid item>
              <Button variant="outlined" onClick={handlePolicyApply}>
                <Icon icon={checkIcon} width="20" height="20" />
                <Typography>Apply</Typography>
              </Button>
            </Grid>
          )}
          {/* The merge functionality still needs to be completed */}
          {/* <Grid item>
          <Button variant="outlined" onClick={handlePolicyMerge}>
            <Typography>Merge</Typography>
          </Button>
        </Grid> */}
          <Grid item>
            <Button
              variant="outlined"
              onClick={() => handlePolicyDelete(selectedPolicies, () => setSelectedPolicies(null))}
            >
              <Typography>Delete</Typography>
            </Button>
          </Grid>
        </Grid>
      )}
      <SectionBox title={title}>
        <SimpleTable
          columns={[
            {
              getter: (data: any) => (
                <Checkbox
                  onChange={(e: any) => handleCheckBox(e, data.metadata.uid)}
                  checked={
                    Boolean(selectedPolicies) && selectedPolicies?.includes(data.metadata.uid)
                  }
                />
              ),
            },
            {
              label: 'Policy',
              getter: (data: any) => (
                <Link
                  onClick={() => {
                    setIsEditorOpen(true);
                    setEditorValue(data);
                  }}
                >
                  {data.metadata.name}
                </Link>
              ),
            },
            {
              label: 'Pod',
              getter: (data: any) => parseSeccompAnnotations(data, 'pod', namespace),
            },
            {
              label: 'Container',
              getter: (data: any) => parseSeccompAnnotations(data, 'container', namespace),
            },
            {
              label: 'Date',
              getter: (data: any) => new Date(data.metadata.creationTimestamp).toLocaleString(),
            },
          ]}
          data={tableData}
        />
      </SectionBox>
    </Box>
  );
}

function SeccompPoliciesTableView(props: any) {
  const { seccompPolicies, appliedPolicies, danglingPolicies } = props;
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editorValue, setEditorValue] = React.useState(null);
  const [errorMessage, setErrorMessage] = React.useState(null);
  const { namespace } = useParams();
  const [massagedSeccompPolicies, setMassagedSeccompPolicies] = React.useState(seccompPolicies);

  const [massagedAppliedPolicies, setMassagedAppliedPolicies] = React.useState(appliedPolicies);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  React.useEffect(() => {
    const rootWorkloadApiForPods = seccompPolicies?.map((policy: any) => {
      return FindRootWorkload(parseSeccompAnnotations(policy, 'pod', namespace), namespace);
    });
    rootWorkloadApiForPods &&
      Promise.all(rootWorkloadApiForPods)
        .catch((error: Error) => {
          console.error(error);
          return rootWorkloadApiForPods;
        })
        .then((rootWorkloads: any) => {
          setMassagedSeccompPolicies((seccompPolicies: any) =>
            seccompPolicies.map((policy: any, index: number) => {
              policy.rootWorkload = rootWorkloads[index]?.kind;
              policy.rootWorkloadName = rootWorkloads[index]?.name;
              return { ...policy };
            })
          );
        });
  }, [seccompPolicies]);

  function handleSave(value: any) {
    updateSeccompPolicy(value)
      .then(() => {
        setIsEditorOpen(false);
      })
      .catch((err: Error) => {
        setErrorMessage(err.message);
      });
  }

  function handlePolicyDelete(policiesToDelete: any, resetSelectedPolicies: () => any) {
    //it could be a delete request for an applied policy or a non-applied policy or a dangling policy so consider all
    const policiesObjects = massagedSeccompPolicies
      ?.concat(massagedAppliedPolicies)
      ?.concat(danglingPolicies)
      .filter((policy: any) => policiesToDelete.includes(policy?.metadata?.uid));
    const policiesToDeleteName = policiesObjects
      .map((policy: any) => policy?.metadata?.name)
      .join(', ');
    enqueueSnackbar(`Are you sure you want to delete policies ${policiesToDeleteName}`, {
      action: key => (
        <>
          <Button
            onClick={() => {
              closeSnackbar(key);
              policyDelete(policiesObjects, policiesToDelete, resetSelectedPolicies);
            }}
            color="secondary"
          >
            Yes
          </Button>
          <Button onClick={() => closeSnackbar(key)} color="secondary">
            No
          </Button>
        </>
      ),
      persist: true,
    });
  }

  function policyDelete(
    policiesToDelete: any,
    selectedPolicies: string[],
    resetSelectedPolicies: () => void
  ) {
    const key = enqueueSnackbar('Delete in progress', { variant: 'warning', persist: true });
    const deletePolicyApi = policiesToDelete.map((policy: any) => {
      return deleteSeccompPolicy(policy);
    });

    Promise.all(deletePolicyApi)
      .catch(error => {
        console.error(error);
        return deletePolicyApi;
      })
      .then(() => {
        closeSnackbar(key);
        let tempSelectedPolicies = [...selectedPolicies];
        resetSelectedPolicies();
        enqueueSnackbar(
          `Deleted Policies ${policiesToDelete
            .map((policy: any) => policy?.metadata?.name)
            .join(', ')} successfully`,
          {
            variant: 'success',
          }
        );
        // refetch policy list to get the updated set of policies
        setMassagedSeccompPolicies(massagedSeccompPolicies =>
          massagedSeccompPolicies.filter(
            (policy: any) => !tempSelectedPolicies.includes(policy?.metadata?.uid)
          )
        );
        setMassagedAppliedPolicies(massagedAppliedPolicies =>
          massagedAppliedPolicies.filter(
            (policy: any) => !tempSelectedPolicies.includes(policy?.metadata?.uid)
          )
        );
      });
  }

  return (
    <Box py={1}>
      <PolicyTableViewGenerator
        title="Seccomp Policies"
        tableData={massagedSeccompPolicies}
        setIsEditorOpen={setIsEditorOpen}
        setEditorValue={setEditorValue}
        handlePolicyDelete={handlePolicyDelete}
        shouldHaveApply={true}
        callback={(item: any) =>
          setMassagedSeccompPolicies(
            massagedSeccompPolicies.filter(
              (policyItem: any) => policyItem.metadata.name !== item?.metadata.name
            )
          )
        }
      />
      <PolicyTableViewGenerator
        title="Applied Policies List"
        tableData={massagedAppliedPolicies}
        setIsEditorOpen={setIsEditorOpen}
        setEditorValue={setEditorValue}
        handlePolicyDelete={handlePolicyDelete}
      />
      <PolicyTableViewGenerator
        title={
          <SectionHeader
            title={
              <>
                Dangling Policies
                <Tooltip title="Policies for which a Pod couldn't be found">
                  <IconButton>
                    <Icon icon={infoIcon} width="20" height="20" />
                  </IconButton>
                </Tooltip>
              </>
            }
          />
        }
        tableData={danglingPolicies}
        setIsEditorOpen={setIsEditorOpen}
        setEditorValue={setEditorValue}
        handlePolicyDelete={handlePolicyDelete}
      />
      {editorValue && (
        <EditorDialog
          item={editorValue}
          open={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSave}
          onEditorChanged={(value: any) => {
            setEditorValue(value);
            setErrorMessage(null);
          }}
          errorMessage={errorMessage}
        />
      )}
    </Box>
  );
}

// Return the previous render value if props haven't changed
export default React.memo(SeccompPoliciesTableView);
