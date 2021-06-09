import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import SyncIcon from '@material-ui/icons/Sync';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Checkbox from '@material-ui/core/Checkbox';
import Paper from '@material-ui/core/Paper';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { ThemeProvider } from '@material-ui/styles';
import { createMuiTheme } from '@material-ui/core/styles';
import green from '@material-ui/core/colors/green';

const useStyles = makeStyles((theme) => ({
  paper: {
    width: 200,
    height: 230,
    overflow: 'auto',
  },
  button: {
    margin: theme.spacing(0.5, 0),
  },
  main: {
    padding: '1em',
  },
  container: {
    margin: '1em',
  },
  outer: {
    display: 'table',
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
  },
  middle: {
    display: 'table-cell',
    verticalAlign: 'middle',
  },
  inner: {
    marginLeft: 'auto',
    marginRight: 'auto',
    width: 600,
    marginBottom: '6em',
  },
}));

const App = () => {
  const classes = useStyles();
  const [checked, setChecked] = React.useState([]);
  const [left, setLeft] = React.useState([]);
  const [right, setRight] = React.useState([]);

  const intersection = (a, b) => {
    return a.filter((value) => b.indexOf(value) !== -1);
  };

  const leftChecked = intersection(checked, left);
  const rightChecked = intersection(checked, right);

  const handleToggle = (value) => () => {
    const currentIndex = checked.indexOf(value);
    const newChecked = [...checked];

    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }

    setChecked(newChecked);
  };

  const not = (a, b) => {
    return a.filter((value) => b.indexOf(value) === -1);
  };

  const handleCheckedRight = () => {
    setRight(right.concat(leftChecked));
    setLeft(not(left, leftChecked));
    setChecked(not(checked, leftChecked));
  };

  const handleCheckedLeft = () => {
    setLeft(left.concat(rightChecked));
    setRight(not(right, rightChecked));
    setChecked(not(checked, rightChecked));
  };

  const customList = (items) => (
    <Paper className={classes.paper}>
      <List dense component='div' role='list'>
        {items.map((value) => {
          const labelId = `transfer-list-item-${value}-label`;

          return (
            <ListItem
              key={value.id}
              role='listitem'
              button
              onClick={handleToggle(value)}
            >
              <ListItemIcon>
                <Checkbox
                  checked={checked.indexOf(value) !== -1}
                  tabIndex={-1}
                  disableRipple
                  inputProps={{ 'aria-labelledby': labelId }}
                />
              </ListItemIcon>
              <ListItemText id={labelId} primary={value.category} />
            </ListItem>
          );
        })}
        <ListItem />
      </List>
    </Paper>
  );

  const [file, setFile] = useState({ name: 'Nahrát šablonu' });
  const [cloudId, setCloudId] = useState();
  const [accessToken, setAccessToken] = useState();
  const data = { categories: [] };
  const generate = () => {
    data.categories = right;
    axios
      .get(`https://api.dotykacka.cz/v2/clouds/${cloudId}/products?limit=100`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      .then((products) => {
        for (let product of products.data.data) {
          let category = data.categories.find(
            (category) => category.id == product._categoryId
          );
          if (category) {
            category.items.push({
              item: product.name,
              price: product.priceWithVat,
            });
          }
        }
        for (let category of data.categories) {
          category.items.sort(
            (a, b) => parseFloat(b.price) - parseFloat(a.price)
          );
        }
        let reader = new FileReader();
        let binary = reader.readAsBinaryString(file);
        reader.onload = () => {
          let zip = new PizZip(reader.result);
          let doc = new Docxtemplater().loadZip(zip);
          try {
            doc.setData(data);
            doc.render();
          } catch (error) {
            function replaceErrors(key, value) {
              if (value instanceof Error) {
                return Object.getOwnPropertyNames(value).reduce(function (
                  error,
                  key
                ) {
                  error[key] = value[key];
                  return error;
                },
                {});
              }
              return value;
            }
            console.log(JSON.stringify({ error: error }, replaceErrors));

            if (error.properties && error.properties.errors instanceof Array) {
              const errorMessages = error.properties.errors
                .map(function (error) {
                  return error.properties.explanation;
                })
                .join('\n');
              console.log('errorMessages', errorMessages);
            }
            throw error;
          }
          let out = doc.getZip().generate({
            type: 'blob',
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
          saveAs(out, 'menu.docx');
        };
      });
  };

  const sync = () => {
    if (accessToken) {
      axios
        .get(
          `https://api.dotykacka.cz/v2/clouds/${cloudId}/categories?limit=100`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        )
        .then((categories) => {
          setLeft(
            categories.data.data.map((category) => {
              return {
                id: category.id,
                category: category.name,
                items: [],
              };
            })
          );
          setRight([]);
        });
    }
  };

  return (
    <ThemeProvider
      theme={createMuiTheme({
        palette: {
          primary: {
            main: green[600],
            contrastText: '#FFF',
          },
        },
      })}
    >
      <div class='outer' className={classes.outer}>
        <div class='middle' className={classes.middle}>
          <div class='inner' className={classes.inner}>
            <Paper elevation={3} className={classes.main}>
              <div className={classes.container}>
                <Typography variant='h4'>dotykacka-menu</Typography>
              </div>
              <div className={classes.container}>
                <TextField
                  label='Cloud ID'
                  variant='outlined'
                  size='small'
                  style={{ marginRight: '1em' }}
                  onChange={(e) => setCloudId(e.target.value)}
                />
                <TextField
                  label='Přístupový token'
                  variant='outlined'
                  size='small'
                  onChange={(e) => setAccessToken(e.target.value)}
                />
                <IconButton onClick={sync}>
                  <SyncIcon />
                </IconButton>
              </div>
              <div className={classes.container}>
                <Grid
                  container
                  spacing={2}
                  alignItems='center'
                  justifyContent='center'
                >
                  <Grid item>{customList(left)}</Grid>
                  <Grid item>
                    <Grid container direction='column' alignItems='center'>
                      <Button
                        variant='outlined'
                        size='small'
                        className={classes.button}
                        onClick={handleCheckedRight}
                        disabled={leftChecked.length === 0}
                      >
                        &gt;
                      </Button>
                      <Button
                        variant='outlined'
                        size='small'
                        className={classes.button}
                        onClick={handleCheckedLeft}
                        disabled={rightChecked.length === 0}
                      >
                        &lt;
                      </Button>
                    </Grid>
                  </Grid>
                  <Grid item>{customList(right)}</Grid>
                </Grid>
              </div>
              <div className={classes.container}>
                <input
                  accept='.docx'
                  id='contained-button-file'
                  onChange={(e) => {
                    setFile(e.target.files[0]);
                  }}
                  type='file'
                  hidden
                />
                <label htmlFor='contained-button-file'>
                  <Button
                    variant='outlined'
                    color='primary'
                    component='span'
                    style={{ marginRight: '1em' }}
                  >
                    {file.name}
                  </Button>
                </label>
                <Button color='primary' variant='contained' onClick={generate}>
                  Vygenerovat
                </Button>
              </div>
            </Paper>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default App;
